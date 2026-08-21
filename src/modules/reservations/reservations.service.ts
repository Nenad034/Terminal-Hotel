import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  HoldReservationDto,
  ConfirmReservationDto,
  CancelReservationDto,
  CheckInDto,
  CheckOutDto,
  ReservationListQueryDto,
} from './dto/reservation.dto';

// Status tranzicione mape — validni prelazi stanja
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  held:       ['booked', 'confirmed', 'cancelled', 'expired'],
  booked:     ['confirmed', 'cancelled', 'no_show'],
  confirmed:  ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['checked_out'],
  checked_out: [],
  cancelled:  [],
  no_show:    [],
  expired:    [],
};

function generateConfirmationNumber(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'TH';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

@Injectable()
export class ReservationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertTransition(current: string, next: string) {
    if (!ALLOWED_TRANSITIONS[current]?.includes(next)) {
      throw new BadRequestException(
        `Rezervacija ne može preći iz statusa '${current}' u '${next}'.`,
      );
    }
  }

  private async recordStatusEvent(
    tx: any,
    reservationId: string,
    fromStatus: string,
    toStatus: string,
    actorEmployeeId?: string,
    note?: string,
  ) {
    await tx.reservationStatusEvent.create({
      data: {
        reservationId,
        fromStatus,
        toStatus,
        actorEmployeeId: actorEmployeeId ?? null,
        actorType: actorEmployeeId ? 'employee' : 'system',
        note,
      },
    });
  }

  // ─── Hold ───────────────────────────────────────────────────────────────────

  async holdReservation(propertyId: string, dto: HoldReservationDto) {
    const checkIn = new Date(dto.checkIn);
    const checkOut = new Date(dto.checkOut);

    if (checkIn >= checkOut) {
      throw new BadRequestException('checkIn mora biti pre checkOut.');
    }

    // Proveri da tip sobe postoji u objektu
    const roomType = await this.prisma.roomType.findFirst({
      where: { id: dto.roomTypeId, propertyId },
    });
    if (!roomType) throw new NotFoundException('Tip sobe nije pronađen.');

    // Proveri raspoloživost — grubo (soft check)
    const conflictingReservations = await this.prisma.reservation.count({
      where: {
        propertyId,
        roomTypeId: dto.roomTypeId,
        status: { in: ['held', 'booked', 'confirmed', 'checked_in'] },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
    });

    const totalRoomsOfType = await this.prisma.room.count({
      where: { propertyId, roomTypeId: dto.roomTypeId, outOfOrder: false, outOfService: false },
    });

    if (conflictingReservations >= totalRoomsOfType) {
      throw new ConflictException(
        `Nema slobodnih soba tipa '${roomType.code}' za traženi period.`,
      );
    }

    const holdDurationMs = (dto.holdDurationMinutes ?? 30) * 60 * 1000;
    const holdExpiresAt = new Date(Date.now() + holdDurationMs);

    // Generišemo unique confirmation number
    let confirmationNumber: string;
    let attempts = 0;
    do {
      confirmationNumber = generateConfirmationNumber();
      const exists = await this.prisma.reservation.findUnique({
        where: { confirmationNumber },
      });
      if (!exists) break;
      attempts++;
    } while (attempts < 10);

    const reservation = await this.prisma.$transaction(async (tx) => {
      const res = await tx.reservation.create({
        data: {
          propertyId,
          confirmationNumber,
          primaryGuestId: dto.primaryGuestId,
          roomTypeId: dto.roomTypeId,
          ratePlanId: dto.ratePlanId,
          status: 'held',
          source: dto.source ?? 'direct',
          channelReference: dto.channelReference,
          externalPackageId: dto.externalPackageId,
          checkIn,
          checkOut,
          adults: dto.adults ?? 1,
          children: dto.children ?? 0,
          specialRequests: dto.specialRequests,
          holdExpiresAt,
        },
        include: { roomType: true, primaryGuest: true },
      });

      await this.recordStatusEvent(tx, res.id, 'none', 'held', undefined, 'Hold kreiran');

      // Otvori folio automatski
      await tx.folio.create({
        data: {
          propertyId,
          reservationId: res.id,
          ownerType: dto.externalPackageId ? 'package_operator' : 'guest',
          ownerGuestId: dto.externalPackageId ? null : dto.primaryGuestId,
          currency: 'RSD',
        },
      });

      return res;
    });

    return {
      ...reservation,
      holdExpiresAt,
      holdDurationMinutes: dto.holdDurationMinutes ?? 30,
    };
  }

  // ─── Confirm ────────────────────────────────────────────────────────────────

  async confirmReservation(
    propertyId: string,
    reservationId: string,
    dto: ConfirmReservationDto,
  ) {
    const reservation = await this.findReservationById(propertyId, reservationId);
    await this.assertTransition(reservation.status, 'confirmed');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.reservation.update({
        where: { id: reservationId },
        data: { status: 'confirmed', holdExpiresAt: null },
        include: { roomType: true, primaryGuest: true, room: true },
      });

      await this.recordStatusEvent(
        tx, reservationId, reservation.status, 'confirmed',
        dto.actorEmployeeId, 'Rezervacija potvrđena',
      );

      return updated;
    });
  }

  // ─── Cancel ─────────────────────────────────────────────────────────────────

  async cancelReservation(
    propertyId: string,
    reservationId: string,
    dto: CancelReservationDto,
  ) {
    const reservation = await this.findReservationById(propertyId, reservationId);
    await this.assertTransition(reservation.status, 'cancelled');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.reservation.update({
        where: { id: reservationId },
        data: { status: 'cancelled', holdExpiresAt: null, roomId: null },
        include: { roomType: true, primaryGuest: true },
      });

      await this.recordStatusEvent(
        tx, reservationId, reservation.status, 'cancelled',
        dto.actorEmployeeId, dto.reason ?? 'Otkazano',
      );

      return updated;
    });
  }

  // ─── Check-In ───────────────────────────────────────────────────────────────

  async checkIn(propertyId: string, reservationId: string, dto: CheckInDto) {
    const reservation = await this.findReservationById(propertyId, reservationId);
    await this.assertTransition(reservation.status, 'checked_in');

    let roomId = dto.roomId ?? reservation.roomId;

    // Ako nije zadata soba, auto-dodeli prvu slobodnu čistu sobu tipa
    if (!roomId) {
      const availableRoom = await this.prisma.room.findFirst({
        where: {
          propertyId,
          roomTypeId: reservation.roomTypeId,
          occupancyStatus: 'vacant',
          cleanlinessStatus: { in: ['clean', 'inspected'] },
          outOfOrder: false,
          outOfService: false,
        },
        orderBy: { roomNumber: 'asc' },
      });

      if (!availableRoom) {
        throw new ConflictException(
          'Nema slobodne čiste sobe ovog tipa za check-in. ' +
          'Dodelite sobu ručno ili promenite tip sobe.',
        );
      }

      roomId = availableRoom.id;
    } else {
      // Verifikacija zadate sobe
      const room = await this.prisma.room.findFirst({
        where: { id: roomId, propertyId, outOfOrder: false },
      });
      if (!room) throw new NotFoundException('Soba nije pronađena ili je van upotrebe.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Ažuriraj rezervaciju
      const updated = await tx.reservation.update({
        where: { id: reservationId },
        data: { status: 'checked_in', roomId },
        include: { roomType: true, primaryGuest: true, room: true },
      });

      // Soba postaje zauzeta i dirty (wake-up dirty = treba čišćenje tokom boravka)
      await tx.room.update({
        where: { id: roomId },
        data: { occupancyStatus: 'occupied' },
      });

      // Audit trag statusa sobe
      await tx.roomStatusEvent.create({
        data: {
          roomId,
          occupancyStatus: 'occupied',
          cleanlinessStatus: updated.room?.cleanlinessStatus ?? 'clean',
          changedBy: dto.actorEmployeeId ?? null,
        },
      });

      await this.recordStatusEvent(
        tx, reservationId, reservation.status, 'checked_in',
        dto.actorEmployeeId, `Check-in — soba ${updated.room?.roomNumber}`,
      );

      return updated;
    });
  }

  // ─── Check-Out ──────────────────────────────────────────────────────────────

  async checkOut(propertyId: string, reservationId: string, dto: CheckOutDto) {
    const reservation = await this.findReservationById(propertyId, reservationId);
    await this.assertTransition(reservation.status, 'checked_out');

    if (!reservation.roomId) {
      throw new BadRequestException('Rezervacija nema dodeljenu sobu.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.reservation.update({
        where: { id: reservationId },
        data: { status: 'checked_out' },
        include: { roomType: true, primaryGuest: true, room: true },
      });

      // Soba postaje slobodna i prljava (housekeeping mora da čisti)
      await tx.room.update({
        where: { id: reservation.roomId! },
        data: { occupancyStatus: 'vacant', cleanlinessStatus: 'dirty' },
      });

      await tx.roomStatusEvent.create({
        data: {
          roomId: reservation.roomId!,
          occupancyStatus: 'vacant',
          cleanlinessStatus: 'dirty',
          changedBy: dto.actorEmployeeId ?? null,
        },
      });

      // Zatvori folio ako nema dugovanja
      await tx.folio.updateMany({
        where: { reservationId, status: 'open' },
        data: { status: 'closed', closedAt: new Date() },
      });

      await this.recordStatusEvent(
        tx, reservationId, reservation.status, 'checked_out',
        dto.actorEmployeeId, 'Check-out završen',
      );

      return updated;
    });
  }

  // ─── Find / List ─────────────────────────────────────────────────────────────

  async findReservationById(propertyId: string, reservationId: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, propertyId },
      include: {
        primaryGuest: true,
        roomType: true,
        room: true,
        ratePlan: { select: { code: true, name: true } },
        folios: {
          include: {
            lineItems: { where: { voidedAt: null } },
            payments: true,
          },
        },
        statusEvents: { orderBy: { occurredAt: 'asc' } },
      },
    });

    if (!reservation) {
      throw new NotFoundException(`Rezervacija ${reservationId} nije pronađena.`);
    }

    return reservation;
  }

  async findByConfirmationNumber(propertyId: string, confirmationNumber: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { propertyId, confirmationNumber: confirmationNumber.toUpperCase() },
      include: { primaryGuest: true, roomType: true, room: true },
    });
    if (!reservation) {
      throw new NotFoundException(`Rezervacija ${confirmationNumber} nije pronađena.`);
    }
    return reservation;
  }

  async listReservations(propertyId: string, query: ReservationListQueryDto) {
    return this.prisma.reservation.findMany({
      where: {
        propertyId,
        ...(query.status && { status: query.status }),
        ...(query.confirmationNumber && {
          confirmationNumber: query.confirmationNumber.toUpperCase(),
        }),
        ...(query.arrivalDate && {
          checkIn: {
            gte: new Date(query.arrivalDate),
            lt: new Date(new Date(query.arrivalDate).getTime() + 86400000),
          },
        }),
        ...(query.departureDate && {
          checkOut: {
            gte: new Date(query.departureDate),
            lt: new Date(new Date(query.departureDate).getTime() + 86400000),
          },
        }),
      },
      include: {
        primaryGuest: { select: { firstName: true, lastName: true, email: true } },
        roomType: { select: { code: true, name: true } },
        room: { select: { roomNumber: true } },
      },
      orderBy: [{ checkIn: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  // ─── TTL Sweep (pozvano iz WorkersService) ───────────────────────────────────

  async expireHeldReservations(): Promise<number> {
    const expiredIds = await this.prisma.reservation.findMany({
      where: {
        status: 'held',
        holdExpiresAt: { lt: new Date() },
      },
      select: { id: true },
    });

    if (expiredIds.length === 0) return 0;

    await this.prisma.$transaction(async (tx) => {
      for (const { id } of expiredIds) {
        await tx.reservation.update({
          where: { id },
          data: { status: 'expired', roomId: null },
        });

        await this.recordStatusEvent(tx, id, 'held', 'expired', undefined, 'TTL sweep — hold istekao');
      }
    });

    return expiredIds.length;
  }
}
