import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CapacityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Jedinstven real-time pregled kapaciteta i zauzetosti svih resursa.
   * Arhitektura pogl. 29: UNION view bez fizičke snapshot tabele za "sada".
   */
  async getCapacityOverview(propertyId: string, asOf?: Date) {
    const now = asOf ?? new Date();

    // ── 1. SOBE ──────────────────────────────────────────────────────────────
    const [roomsByType, activeRoomReservations] = await Promise.all([
      this.prisma.roomType.findMany({
        where: { propertyId },
        include: {
          rooms: {
            where: { propertyId, outOfOrder: false, outOfService: false },
            select: { id: true, occupancyStatus: true, cleanlinessStatus: true },
          },
          _count: { select: { rooms: true } },
        },
      }),
      this.prisma.reservation.findMany({
        where: {
          propertyId,
          status: 'checked_in',
          checkIn: { lte: now },
          checkOut: { gt: now },
        },
        select: { roomId: true, roomTypeId: true },
      }),
    ]);

    const occupiedRoomIds = new Set(
      activeRoomReservations.map((r) => r.roomId).filter(Boolean),
    );

    const roomCapacity = roomsByType.map((rt) => {
      const validRooms = rt.rooms;
      const occupied = validRooms.filter((r) => occupiedRoomIds.has(r.id)).length;
      const dirty = validRooms.filter((r) => r.cleanlinessStatus === 'dirty').length;
      const available = validRooms.filter(
        (r) =>
          !occupiedRoomIds.has(r.id) &&
          r.cleanlinessStatus !== 'dirty' &&
          r.occupancyStatus === 'vacant',
      ).length;

      return {
        resourceType: 'ROOM' as const,
        category: rt.code,
        name: rt.name,
        accessible: rt.accessible,
        total: validRooms.length,
        occupied,
        available,
        dirty,
        occupancyRate: validRooms.length > 0
          ? Math.round((occupied / validRooms.length) * 100)
          : 0,
      };
    });

    // ── 2. RESTORAN / DINNING ──────────────────────────────────────────────────
    const diningOutlets = await this.prisma.diningOutlet.findMany({
      where: { propertyId },
      include: {
        tables: true,
        reservations: {
          where: {
            status: { in: ['booked', 'seated'] },
            reservationTime: {
              gte: new Date(now.getTime() - 120 * 60 * 1000), // rezervacije unutar ±2h
              lte: new Date(now.getTime() + 120 * 60 * 1000),
            },
          },
        },
      },
    });

    const diningCapacity = diningOutlets.map((outlet) => {
      const totalTables = outlet.tables.length;
      const occupiedTables = outlet.tables.filter(
        (t) => t.status === 'occupied' || t.status === 'reserved',
      ).length;

      return {
        resourceType: 'DINING_TABLE' as const,
        outletId: outlet.id,
        outletName: outlet.name,
        outletType: outlet.outletType,
        totalSeats: outlet.totalSeats,
        totalTables,
        occupiedOrReservedTables: occupiedTables,
        availableTables: Math.max(0, totalTables - occupiedTables),
        upcomingReservations: outlet.reservations.length,
      };
    });

    // ── 3. SPA ────────────────────────────────────────────────────────────────
    const spaResources = await this.prisma.spaResource.findMany({
      where: { propertyId },
      include: { status: true },
    });

    const spaCapacity = {
      resourceType: 'SPA_RESOURCE' as const,
      total: spaResources.length,
      available: spaResources.filter((r) => r.status?.status === 'available').length,
      occupied: spaResources.filter((r) => r.status?.status === 'occupied').length,
      blocked: spaResources.filter((r) => r.status?.status === 'blocked').length,
    };

    // ── 4. KONGRESNE SALE ──────────────────────────────────────────────────────
    const functionSpaces = await this.prisma.functionSpace.findMany({
      where: { propertyId },
      include: {
        bookings: {
          where: {
            status: { in: ['tentative', 'definite'] },
            startAt: { lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
            endAt: { gte: now },
          },
          select: { id: true, status: true, setupType: true, startAt: true, endAt: true },
        },
      },
    });

    const functionSpaceCapacity = functionSpaces.map((fs) => {
      const currentBooking = fs.bookings.find(
        (b) => new Date(b.startAt) <= now && new Date(b.endAt) >= now,
      );

      return {
        resourceType: 'FUNCTION_SPACE' as const,
        id: fs.id,
        name: fs.name,
        capacityBySetup: fs.capacityBySetup,
        status: currentBooking ? 'occupied' : 'available',
        currentBooking: currentBooking ?? null,
        upcomingBookings: fs.bookings.filter(
          (b) => new Date(b.startAt) > now,
        ).length,
      };
    });

    // ── Agregate sobe ─────────────────────────────────────────────────────────
    const roomTotals = roomCapacity.reduce(
      (acc, r) => ({
        total: acc.total + r.total,
        occupied: acc.occupied + r.occupied,
        available: acc.available + r.available,
        dirty: acc.dirty + r.dirty,
      }),
      { total: 0, occupied: 0, available: 0, dirty: 0 },
    );

    return {
      asOf: now.toISOString(),
      propertyId,
      rooms: {
        summary: {
          ...roomTotals,
          occupancyRate:
            roomTotals.total > 0
              ? Math.round((roomTotals.occupied / roomTotals.total) * 100)
              : 0,
        },
        byType: roomCapacity,
      },
      dining: diningCapacity,
      spa: spaCapacity,
      functionSpaces: functionSpaceCapacity,
    };
  }

  /**
   * Istorijski pregled zauzetosti iz occupancy_snapshot_daily.
   * Koristi se za trend prikaz (prošlih dana/nedelja/meseci).
   */
  async getOccupancyHistory(
    propertyId: string,
    from: Date,
    to: Date,
    resourceType?: string,
  ) {
    return this.prisma.occupancySnapshotDaily.findMany({
      where: {
        propertyId,
        snapshotDate: { gte: from, lte: to },
        ...(resourceType && { resourceType }),
      },
      orderBy: [{ snapshotDate: 'asc' }, { resourceType: 'asc' }],
    });
  }
}
