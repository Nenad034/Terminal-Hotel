import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EarnPointsDto, RedeemPointsDto, AdjustPointsDto, CreateLoyaltyTierDto } from './dto/loyalty.dto';

const DEFAULT_EXPIRY_MONTHS = 24;
const QUALIFYING_WINDOW_MONTHS = 12;

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertGuestExists(guestProfileId: string) {
    const guest = await this.prisma.guestProfile.findUnique({ where: { id: guestProfileId } });
    if (!guest) throw new NotFoundException(`Gost ${guestProfileId} nije pronađen.`);
    return guest;
  }

  async earnPoints(guestProfileId: string, dto: EarnPointsDto) {
    await this.assertGuestExists(guestProfileId);
    const expiresAt = dto.expiresAt
      ? new Date(dto.expiresAt)
      : new Date(new Date().setMonth(new Date().getMonth() + DEFAULT_EXPIRY_MONTHS));

    return this.prisma.loyaltyPointTransaction.create({
      data: {
        guestProfileId,
        transactionType: 'earn',
        amount: dto.amount,
        sourceReservationId: dto.sourceReservationId,
        expiresAt,
        description: dto.description,
      },
    });
  }

  async redeemPoints(guestProfileId: string, dto: RedeemPointsDto) {
    await this.assertGuestExists(guestProfileId);
    const { available } = await this.getBalance(guestProfileId);
    if (dto.amount > available) {
      throw new BadRequestException(`Nedovoljno bodova: raspoloživo ${available}, traženo ${dto.amount}.`);
    }

    return this.prisma.loyaltyPointTransaction.create({
      data: {
        guestProfileId,
        transactionType: 'redeem',
        amount: -dto.amount,
        description: dto.description,
      },
    });
  }

  async adjustPoints(guestProfileId: string, dto: AdjustPointsDto) {
    await this.assertGuestExists(guestProfileId);
    return this.prisma.loyaltyPointTransaction.create({
      data: {
        guestProfileId,
        transactionType: 'adjust',
        amount: dto.amount,
        description: dto.description,
      },
    });
  }

  /**
   * Append-only ledger bez lot-tracking-a: earn transakcija se u celosti
   * isključuje iz stanja kad joj istekne expiresAt (bez FIFO potrošnje kroz
   * delimične redeem-e). Namerno pojednostavljenje za v1.
   */
  async getBalance(guestProfileId: string) {
    const now = new Date();
    const transactions = await this.prisma.loyaltyPointTransaction.findMany({
      where: { guestProfileId, status: 'posted' },
    });

    const available = transactions.reduce((sum, t) => {
      if (t.transactionType === 'earn' && t.expiresAt && t.expiresAt <= now) return sum;
      return sum + t.amount;
    }, 0);

    return { guestProfileId, available };
  }

  async getHistory(guestProfileId: string) {
    return this.prisma.loyaltyPointTransaction.findMany({
      where: { guestProfileId },
      orderBy: { earnedAt: 'desc' },
    });
  }

  createTier(dto: CreateLoyaltyTierDto) {
    return this.prisma.loyaltyTier.create({
      data: {
        tierName: dto.tierName,
        qualifyingNights: dto.qualifyingNights,
        qualifyingStays: dto.qualifyingStays,
        qualifyingSpend: dto.qualifyingSpend,
      },
    });
  }

  findTiers() {
    return this.prisma.loyaltyTier.findMany({ orderBy: { qualifyingNights: 'asc' } });
  }

  /**
   * OR logika kroz dimenzije: gost dostiže nivo ako ispuni BILO KOJI od
   * (noćenja, boravci, potrošnja) definisanih za taj nivo, u prethodnih 12
   * meseci. Bira se najviši nivo koji gost ispunjava.
   */
  async recalculateTier(guestProfileId: string) {
    const guest = await this.assertGuestExists(guestProfileId);
    const windowStart = new Date();
    windowStart.setMonth(windowStart.getMonth() - QUALIFYING_WINDOW_MONTHS);

    const reservations = await this.prisma.reservation.findMany({
      where: { primaryGuestId: guestProfileId, status: 'checked_out', checkOut: { gte: windowStart } },
      include: { folios: { include: { lineItems: true } } },
    });

    const qualifyingStays = reservations.length;
    const qualifyingNights = reservations.reduce((sum, r) => {
      const nights = Math.round((r.checkOut.getTime() - r.checkIn.getTime()) / (1000 * 60 * 60 * 24));
      return sum + Math.max(0, nights);
    }, 0);
    const qualifyingSpend = reservations.reduce((sum, r) => {
      const folioSpend = r.folios.reduce(
        (fSum, f) => fSum + f.lineItems.filter((li) => !li.voidedAt).reduce((liSum, li) => liSum + Number(li.totalAmount), 0),
        0,
      );
      return sum + folioSpend;
    }, 0);

    const tiers = await this.findTiers();
    const qualified = tiers.filter(
      (t) =>
        (t.qualifyingNights != null && qualifyingNights >= t.qualifyingNights) ||
        (t.qualifyingStays != null && qualifyingStays >= t.qualifyingStays) ||
        (t.qualifyingSpend != null && qualifyingSpend >= Number(t.qualifyingSpend)),
    );

    const highestTier = qualified.sort((a, b) => {
      const rank = (t: typeof a) => Math.max(t.qualifyingNights ?? 0, t.qualifyingStays ?? 0, Number(t.qualifyingSpend ?? 0));
      return rank(b) - rank(a);
    })[0];

    const now = new Date();

    if (!highestTier) {
      return {
        guestProfileId,
        qualifyingNights,
        qualifyingStays,
        qualifyingSpend,
        assignedTier: guest.loyaltyTier ?? null,
        changed: false,
        note: 'Gost ne ispunjava nijedan definisan nivo — zadržava postojeći tier (bez uklanjanja postojećih assignment-a).',
      };
    }

    if (guest.loyaltyTier === highestTier.tierName) {
      return { guestProfileId, qualifyingNights, qualifyingStays, qualifyingSpend, assignedTier: highestTier.tierName, changed: false };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.loyaltyTierAssignment.updateMany({
        where: { guestProfileId, effectiveTo: null },
        data: { effectiveTo: now },
      });
      await tx.loyaltyTierAssignment.create({
        data: {
          guestProfileId,
          tierId: highestTier.id,
          effectiveFrom: now,
          qualifyingPeriod: `${QUALIFYING_WINDOW_MONTHS}m-trailing`,
        },
      });
      await tx.guestProfile.update({ where: { id: guestProfileId }, data: { loyaltyTier: highestTier.tierName } });
    });

    return { guestProfileId, qualifyingNights, qualifyingStays, qualifyingSpend, assignedTier: highestTier.tierName, changed: true };
  }
}
