import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateRatePlanDto,
  BulkUpdateRatesDto,
  RateCalendarQueryDto,
  AvailabilityQueryDto,
} from './dto/rate.dto';

@Injectable()
export class RatesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Rate Plans ─────────────────────────────────────────────────────────────

  async createRatePlan(propertyId: string, dto: CreateRatePlanDto) {
    return this.prisma.ratePlan.create({
      data: {
        propertyId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        isPublic: dto.isPublic ?? true,
        cancellationPolicy: dto.cancellationPolicy ?? {},
        minLos: dto.minLos,
        maxLos: dto.maxLos,
        closedToArrival: dto.closedToArrival ?? false,
        closedToDeparture: dto.closedToDeparture ?? false,
        lastRoomAvailability: dto.lastRoomAvailability ?? false,
        currency: dto.currency ?? 'RSD',
        rateGroupId: dto.rateGroupId,
        corporateAccountId: dto.corporateAccountId,
      },
    });
  }

  async findRatePlans(propertyId: string) {
    return this.prisma.ratePlan.findMany({
      where: { propertyId },
      include: {
        rateGroup: { select: { id: true, name: true } },
        corporateAccount: { select: { id: true, companyName: true } },
        _count: { select: { rates: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  async findRatePlanById(propertyId: string, ratePlanId: string) {
    const rp = await this.prisma.ratePlan.findFirst({
      where: { id: ratePlanId, propertyId },
      include: {
        rateGroup: true,
        corporateAccount: true,
      },
    });
    if (!rp) throw new NotFoundException(`Rate plan ${ratePlanId} nije pronađen.`);
    return rp;
  }

  // ─── Rate Calendar ──────────────────────────────────────────────────────────

  async bulkUpdateRates(propertyId: string, dto: BulkUpdateRatesDto) {
    // Verifikuj da rate plan pripada objektu
    await this.findRatePlanById(propertyId, dto.ratePlanId);

    const ops = dto.rates.map((r) =>
      this.prisma.rate.upsert({
        where: {
          ratePlanId_roomTypeId_stayDate: {
            ratePlanId: dto.ratePlanId,
            roomTypeId: r.roomTypeId,
            stayDate: new Date(r.stayDate),
          },
        },
        update: {
          price: r.price,
          ...(r.minLosOverride !== undefined && { minLosOverride: r.minLosOverride }),
          ...(r.closedToArrivalOverride !== undefined && {
            closedToArrivalOverride: r.closedToArrivalOverride,
          }),
        },
        create: {
          ratePlanId: dto.ratePlanId,
          roomTypeId: r.roomTypeId,
          stayDate: new Date(r.stayDate),
          price: r.price,
          minLosOverride: r.minLosOverride,
          closedToArrivalOverride: r.closedToArrivalOverride,
        },
      }),
    );

    const results = await this.prisma.$transaction(ops);
    return { updated: results.length, ratePlanId: dto.ratePlanId };
  }

  async getRateCalendar(propertyId: string, query: RateCalendarQueryDto) {
    const from = new Date(query.from);
    const to = new Date(query.to);

    if (from >= to) {
      throw new BadRequestException('Datum "from" mora biti pre datuma "to".');
    }

    const rates = await this.prisma.rate.findMany({
      where: {
        ratePlan: { propertyId },
        stayDate: { gte: from, lte: to },
        ...(query.roomTypeId && { roomTypeId: query.roomTypeId }),
        ...(query.ratePlanId && { ratePlanId: query.ratePlanId }),
      },
      include: {
        ratePlan: { select: { code: true, name: true, minLos: true, closedToArrival: true } },
        roomType: { select: { code: true, name: true } },
      },
      orderBy: [{ stayDate: 'asc' }, { ratePlanId: 'asc' }],
    });

    return { from: query.from, to: query.to, count: rates.length, rates };
  }

  // ─── Availability Check ─────────────────────────────────────────────────────

  /**
   * Korporativna cena je RatePlan sa ograničenom vidljivošću (isPublic=false)
   * vezan za CorporateAccount preko access_code (pogl. 25). LRA (Last Room
   * Availability) je override flag koji zaobilazi min-LOS/closed-to-arrival
   * restrikcije specifično za taj plan — NE garantuje fizičku sobu kad je
   * objekat stvarno pun (nema modelovan zaseban korporativni allotment pool,
   * pa se ne pretvara da postoji soba koje nema).
   */
  private async resolveEligibleRatePlans(propertyId: string, corporateAccessCode?: string) {
    let corporateAccountId: string | undefined;
    if (corporateAccessCode) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const account = await this.prisma.corporateAccount.findUnique({
        where: { accessCode: corporateAccessCode },
      });
      if (
        account &&
        account.organizationId &&
        (!account.contractStart || account.contractStart <= today) &&
        (!account.contractEnd || account.contractEnd >= today)
      ) {
        corporateAccountId = account.id;
      }
    }

    return this.prisma.ratePlan.findMany({
      where: {
        propertyId,
        OR: [{ isPublic: true }, ...(corporateAccountId ? [{ corporateAccountId }] : [])],
      },
    });
  }

  async checkAvailability(propertyId: string, query: AvailabilityQueryDto) {
    const checkIn = new Date(query.checkIn);
    const checkOut = new Date(query.checkOut);

    if (checkIn >= checkOut) {
      throw new BadRequestException('checkIn mora biti pre checkOut.');
    }

    const nights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24),
    );

    const eligiblePlans = await this.resolveEligibleRatePlans(propertyId, query.corporateAccessCode);

    // Svi tipovi soba u objektu
    const roomTypes = await this.prisma.roomType.findMany({
      where: { propertyId },
      include: {
        _count: { select: { rooms: true } },
      },
    });

    const results = await Promise.all(
      roomTypes.map(async (rt) => {
        // Ukupan broj soba ovog tipa
        const totalRooms = await this.prisma.room.count({
          where: {
            propertyId,
            roomTypeId: rt.id,
            outOfOrder: false,
            outOfService: false,
          },
        });

        // Rezervacije koje se preklapaju sa traženim periodom
        const bookedRooms = await this.prisma.reservation.count({
          where: {
            propertyId,
            roomTypeId: rt.id,
            status: { in: ['booked', 'confirmed', 'checked_in', 'held'] },
            checkIn: { lt: checkOut },
            checkOut: { gt: checkIn },
          },
        });

        // Uzimamo u obzir i group block allotmente
        const blockedByGroup = await this.prisma.groupBlockAllotment.aggregate({
          where: {
            roomTypeId: rt.id,
            stayDate: { gte: checkIn, lt: checkOut },
            groupBlock: { propertyId },
          },
          _sum: { totalRooms: true, pickedUp: true },
        });

        const groupBlocked = Math.max(
          0,
          (blockedByGroup._sum.totalRooms ?? 0) - (blockedByGroup._sum.pickedUp ?? 0),
        );

        const available = Math.max(0, totalRooms - bookedRooms - groupBlocked);

        // Za svaki podobni rate plan proveri min-LOS/closed-to-arrival (LRA planovi
        // ih zaobilaze) i sakupi cene po noćenju — plan se nudi samo ako ima cenu
        // upisanu za SVAKI dan boravka.
        let bestPlan: { code: string; total: number } | null = null;

        for (const plan of eligiblePlans) {
          const rates = await this.prisma.rate.findMany({
            where: { roomTypeId: rt.id, ratePlanId: plan.id, stayDate: { gte: checkIn, lt: checkOut } },
            orderBy: { stayDate: 'asc' },
          });
          if (rates.length !== nights) continue; // nepotpun kalendar cena za ovaj plan

          if (!plan.lastRoomAvailability) {
            const arrivalRate = rates[0];
            const effectiveMinLos = arrivalRate.minLosOverride ?? plan.minLos ?? 1;
            if (nights < effectiveMinLos) continue;

            const effectiveClosedToArrival = arrivalRate.closedToArrivalOverride ?? plan.closedToArrival;
            if (effectiveClosedToArrival) continue;
          }

          const total = rates.reduce((sum, r) => sum + Number(r.price), 0);
          if (!bestPlan || total < bestPlan.total) {
            bestPlan = { code: plan.code, total };
          }
        }

        return {
          roomTypeId: rt.id,
          code: rt.code,
          name: rt.name,
          accessible: rt.accessible,
          baseOccupancy: rt.baseOccupancy,
          maxOccupancy: rt.maxOccupancy,
          totalRooms,
          available,
          isAvailable: available > 0,
          ratePlanCode: bestPlan?.code ?? null,
          lowestNightlyRate: bestPlan ? Math.round((bestPlan.total / nights) * 100) / 100 : null,
          totalForStay: bestPlan ? bestPlan.total : null,
          nights,
        };
      }),
    );

    return {
      checkIn: query.checkIn,
      checkOut: query.checkOut,
      nights,
      adults: query.adults ?? 1,
      roomTypes: results.filter((r) => r.available > 0),
      unavailableRoomTypes: results.filter((r) => !r.available),
    };
  }
}
