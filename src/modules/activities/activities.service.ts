import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FoliosService } from '../folios/folios.service';
import { CreateActivityBookingDto, UpdateActivityStatusDto, ChargeActivityToFolioDto } from './dto/activity.dto';

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly foliosService: FoliosService,
  ) {}

  async createBooking(propertyId: string, reservationId: string, dto: CreateActivityBookingDto) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, propertyId },
    });
    if (!reservation) throw new NotFoundException(`Rezervacija ${reservationId} nije pronađena.`);

    return this.prisma.activityBooking.create({
      data: {
        reservationId,
        guestProfileId: dto.guestProfileId ?? reservation.primaryGuestId,
        activityName: dto.activityName,
        provider: dto.provider,
        externalRef: dto.externalRef,
        scheduledAt: new Date(dto.scheduledAt),
        paxCount: dto.paxCount ?? 1,
        totalPrice: dto.totalPrice,
        currency: dto.currency ?? 'RSD',
        status: 'requested',
      },
    });
  }

  async findForReservation(propertyId: string, reservationId: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, propertyId },
    });
    if (!reservation) throw new NotFoundException(`Rezervacija ${reservationId} nije pronađena.`);

    return this.prisma.activityBooking.findMany({
      where: { reservationId },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  /** Agregovan itinerar gosta preko svih boravaka — pogl. 11: "agregacija, ne novi izvor istine". */
  async findForGuest(propertyId: string, guestProfileId: string) {
    return this.prisma.activityBooking.findMany({
      where: { guestProfileId, reservation: { propertyId } },
      include: { reservation: { select: { confirmationNumber: true, checkIn: true, checkOut: true } } },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  private async findBookingOrThrow(propertyId: string, bookingId: string) {
    const booking = await this.prisma.activityBooking.findFirst({
      where: { id: bookingId, reservation: { propertyId } },
      include: { reservation: true },
    });
    if (!booking) throw new NotFoundException(`Aktivnost ${bookingId} nije pronađena.`);
    return booking;
  }

  async updateStatus(propertyId: string, bookingId: string, dto: UpdateActivityStatusDto) {
    await this.findBookingOrThrow(propertyId, bookingId);
    return this.prisma.activityBooking.update({
      where: { id: bookingId },
      data: { status: dto.status },
    });
  }

  /**
   * Naplata na folio — jedan od tri režima naplate iz pogl. 11 (folio_charge,
   * uz referral/affiliate i concierge resale koji ne diraju folio uopšte).
   */
  async chargeToFolio(propertyId: string, bookingId: string, dto: ChargeActivityToFolioDto) {
    const booking = await this.findBookingOrThrow(propertyId, bookingId);
    if (booking.status === 'cancelled') {
      throw new BadRequestException('Otkazana aktivnost se ne može knjižiti na folio.');
    }

    const folio = await this.prisma.folio.findFirst({
      where: { reservationId: booking.reservationId, propertyId, status: 'open' },
    });
    if (!folio) throw new BadRequestException('Otvoren folio za ovu rezervaciju nije pronađen.');

    return this.foliosService.addCharge(propertyId, folio.id, {
      chargeDate: new Date().toISOString().split('T')[0],
      description: `Aktivnost — ${booking.activityName}`,
      revenueCategory: 'activities',
      unitPrice: Number(booking.totalPrice),
      taxRate: 0,
      postedBy: dto.postedBy,
    });
  }
}
