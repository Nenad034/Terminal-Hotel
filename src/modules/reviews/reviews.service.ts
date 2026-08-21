import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface ReviewRequestRecord {
  reservationId: string;
  requestedAt: string;
  channel: 'email';
}

/**
 * Piše nazad u GuestProfile.preferences (nema sopstvenog entiteta — arhitektura
 * pogl. 27 namerno izbegava novu tabelu jer je ovo tanak trigger sloj iznad
 * postojećeg marketing_consent-a). "Slanje" ankete (TrustYou/Revinate obrazac)
 * je simulirano — stvarna integracija sa provajderom nije u obimu v1.
 */
@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private getReviewRequests(preferences: unknown): ReviewRequestRecord[] {
    const prefs = (preferences ?? {}) as Record<string, unknown>;
    return Array.isArray(prefs.reviewRequests) ? (prefs.reviewRequests as ReviewRequestRecord[]) : [];
  }

  async requestReviewForReservation(propertyId: string, reservationId: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, propertyId },
      include: { primaryGuest: true },
    });
    if (!reservation) throw new NotFoundException(`Rezervacija ${reservationId} nije pronađena.`);
    if (reservation.status !== 'checked_out') {
      throw new BadRequestException('Zahtev za recenziju se šalje tek nakon checkout-a (stay-completion event).');
    }

    const guest = reservation.primaryGuest;
    const existingRequests = this.getReviewRequests(guest.preferences);

    if (!guest.marketingConsent) {
      return { sent: false, reason: 'no_marketing_consent', guestProfileId: guest.id, reservationId };
    }
    if (existingRequests.some((r) => r.reservationId === reservationId)) {
      return { sent: false, reason: 'already_requested', guestProfileId: guest.id, reservationId };
    }

    const record: ReviewRequestRecord = { reservationId, requestedAt: new Date().toISOString(), channel: 'email' };
    const prefs = (guest.preferences ?? {}) as Record<string, unknown>;

    await this.prisma.guestProfile.update({
      where: { id: guest.id },
      data: { preferences: { ...prefs, reviewRequests: [...existingRequests, record] } as unknown as Prisma.InputJsonValue },
    });

    this.logger.log(`Review-request (simulirano) poslat gostu ${guest.id} za rezervaciju ${reservationId}.`);
    return { sent: true, guestProfileId: guest.id, ...record };
  }

  async listReviewRequests(guestProfileId: string) {
    const guest = await this.prisma.guestProfile.findUnique({ where: { id: guestProfileId } });
    if (!guest) throw new NotFoundException(`Gost ${guestProfileId} nije pronađen.`);
    return this.getReviewRequests(guest.preferences);
  }

  /**
   * Noćna pretraga (03:30) — pronalazi rezervacije koje su odjavljene u
   * poslednja 3 dana i još nemaju zabeležen review-request.
   */
  @Cron('30 3 * * *', { timeZone: 'Europe/Belgrade' })
  async runAutoReviewRequests() {
    try {
      const since = new Date();
      since.setDate(since.getDate() - 3);

      const candidates = await this.prisma.reservation.findMany({
        where: { status: 'checked_out', checkOut: { gte: since } },
        select: { id: true, propertyId: true },
      });

      let sent = 0;
      for (const c of candidates) {
        const result = await this.requestReviewForReservation(c.propertyId, c.id);
        if (result.sent) sent++;
      }
      if (candidates.length > 0) {
        this.logger.log(`Auto review-request: ${sent}/${candidates.length} poslato.`);
      }
    } catch (err) {
      this.logger.error('Auto review-request greška:', err);
    }
  }

  async runAutoReviewRequestsManual() {
    await this.runAutoReviewRequests();
    return { message: 'Auto review-request pokrenut ručno — pogledaj log za detalje.' };
  }
}
