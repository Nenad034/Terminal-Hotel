import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FoliosService } from '../folios/folios.service';
import {
  CreateOutletDto,
  CreateTableDto,
  UpdateTableStatusDto,
  CreateDiningReservationDto,
  UpdateDiningReservationDto,
  PostToRoomDto,
} from './dto/dining.dto';

@Injectable()
export class DiningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly foliosService: FoliosService,
  ) {}

  // ─── Outlets ────────────────────────────────────────────────────────────────

  async createOutlet(propertyId: string, dto: CreateOutletDto) {
    return this.prisma.diningOutlet.create({
      data: {
        propertyId,
        name: dto.name,
        outletType: dto.outletType ?? 'restaurant',
        totalSeats: dto.totalSeats ?? 0,
      },
    });
  }

  async findOutlets(propertyId: string) {
    return this.prisma.diningOutlet.findMany({
      where: { propertyId },
      include: { _count: { select: { tables: true } } },
      orderBy: { name: 'asc' },
    });
  }

  private async findOutletOrThrow(propertyId: string, outletId: string) {
    const outlet = await this.prisma.diningOutlet.findFirst({
      where: { id: outletId, propertyId },
    });
    if (!outlet) throw new NotFoundException(`Ugostiteljski objekat ${outletId} nije pronađen.`);
    return outlet;
  }

  async findOutletById(propertyId: string, outletId: string) {
    await this.findOutletOrThrow(propertyId, outletId);
    return this.prisma.diningOutlet.findFirst({
      where: { id: outletId, propertyId },
      include: { tables: { orderBy: { tableNumber: 'asc' } } },
    });
  }

  // ─── Tables ─────────────────────────────────────────────────────────────────

  async createTable(propertyId: string, outletId: string, dto: CreateTableDto) {
    await this.findOutletOrThrow(propertyId, outletId);
    const existing = await this.prisma.diningTable.findUnique({
      where: { outletId_tableNumber: { outletId, tableNumber: dto.tableNumber } },
    });
    if (existing) {
      throw new ConflictException(`Sto '${dto.tableNumber}' već postoji u ovom objektu.`);
    }
    return this.prisma.diningTable.create({
      data: {
        outletId,
        tableNumber: dto.tableNumber,
        seatCapacity: dto.seatCapacity ?? 2,
      },
    });
  }

  async findTables(propertyId: string, outletId: string) {
    await this.findOutletOrThrow(propertyId, outletId);
    return this.prisma.diningTable.findMany({
      where: { outletId },
      orderBy: { tableNumber: 'asc' },
    });
  }

  private async findTableOrThrow(propertyId: string, tableId: string) {
    const table = await this.prisma.diningTable.findFirst({
      where: { id: tableId, outlet: { propertyId } },
    });
    if (!table) throw new NotFoundException(`Sto ${tableId} nije pronađen.`);
    return table;
  }

  async updateTableStatus(propertyId: string, tableId: string, dto: UpdateTableStatusDto) {
    await this.findTableOrThrow(propertyId, tableId);
    return this.prisma.diningTable.update({
      where: { id: tableId },
      data: { status: dto.status },
    });
  }

  // ─── Reservations ───────────────────────────────────────────────────────────

  async createReservation(propertyId: string, outletId: string, dto: CreateDiningReservationDto) {
    await this.findOutletOrThrow(propertyId, outletId);
    if (dto.tableId) await this.findTableOrThrow(propertyId, dto.tableId);

    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.diningReservation.create({
        data: {
          outletId,
          tableId: dto.tableId,
          guestProfileId: dto.guestProfileId,
          partySize: dto.partySize,
          reservationTime: new Date(dto.reservationTime),
          durationMinutesEstimate: dto.durationMinutesEstimate ?? 90,
        },
      });

      if (dto.tableId) {
        await tx.diningTable.update({
          where: { id: dto.tableId },
          data: { status: 'reserved', currentBookingId: reservation.id },
        });
      }

      return reservation;
    });
  }

  async findReservations(propertyId: string, outletId: string) {
    await this.findOutletOrThrow(propertyId, outletId);
    return this.prisma.diningReservation.findMany({
      where: { outletId },
      include: {
        table: { select: { tableNumber: true } },
        guestProfile: { select: { firstName: true, lastName: true } },
      },
      orderBy: { reservationTime: 'desc' },
    });
  }

  private async findReservationOrThrow(propertyId: string, reservationId: string) {
    const res = await this.prisma.diningReservation.findFirst({
      where: { id: reservationId, outlet: { propertyId } },
    });
    if (!res) throw new NotFoundException(`Rezervacija stola ${reservationId} nije pronađena.`);
    return res;
  }

  async updateReservationStatus(
    propertyId: string,
    reservationId: string,
    dto: UpdateDiningReservationDto,
  ) {
    const res = await this.findReservationOrThrow(propertyId, reservationId);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.diningReservation.update({
        where: { id: reservationId },
        data: { status: dto.status },
      });

      // Kad rezervacija završi svoj životni ciklus, oslobodi sto ako je i dalje na njoj.
      const freeingStatuses = ['completed', 'cancelled', 'no_show'];
      if (res.tableId && freeingStatuses.includes(dto.status)) {
        const table = await tx.diningTable.findUnique({ where: { id: res.tableId } });
        if (table?.currentBookingId === reservationId) {
          await tx.diningTable.update({
            where: { id: res.tableId },
            data: { status: 'available', currentBookingId: null },
          });
        }
      } else if (res.tableId && dto.status === 'seated') {
        await tx.diningTable.update({
          where: { id: res.tableId },
          data: { status: 'occupied' },
        });
      }

      return updated;
    });
  }

  // ─── POS "post to room" (pogl. 5 — Toast Tender obrazac) ────────────────────

  async postToRoom(propertyId: string, dto: PostToRoomDto) {
    const room = await this.prisma.room.findFirst({
      where: { propertyId, roomNumber: dto.roomNumber },
    });
    if (!room) throw new NotFoundException(`Soba '${dto.roomNumber}' nije pronađena.`);

    const reservation = await this.prisma.reservation.findFirst({
      where: { propertyId, roomId: room.id, status: 'checked_in' },
      orderBy: { checkIn: 'desc' },
    });
    if (!reservation) {
      throw new BadRequestException(
        `Nema gosta prijavljenog (checked_in) u sobi '${dto.roomNumber}' — naplata na sobu nije moguća.`,
      );
    }

    const folio = await this.prisma.folio.findFirst({
      where: { reservationId: reservation.id, propertyId, status: 'open' },
    });
    if (!folio) {
      throw new BadRequestException(`Otvoren folio za sobu '${dto.roomNumber}' nije pronađen.`);
    }

    return this.foliosService.addCharge(propertyId, folio.id, {
      chargeDate: new Date().toISOString().split('T')[0],
      description: dto.description,
      revenueCategory: 'fnb',
      unitPrice: dto.amount,
      taxRate: dto.taxRate ?? 0.2,
      postedBy: dto.postedBy,
    });
  }
}
