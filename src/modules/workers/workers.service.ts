import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { ReservationsService } from '../reservations/reservations.service';
import { FoliosService } from '../folios/folios.service';
import { CapacityService } from '../capacity/capacity.service';
import { FinanceService } from '../finance/finance.service';

@Injectable()
export class WorkersService {
  private readonly logger = new Logger(WorkersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservationsService: ReservationsService,
    private readonly foliosService: FoliosService,
    private readonly capacityService: CapacityService,
    private readonly financeService: FinanceService,
  ) {}

  // ─── TTL Sweep — svakih 60 sekundi ────────────────────────────────────────
  /**
   * Pronalazi sve rezervacije sa status='held' i isteklim holdExpiresAt.
   * Prebacuje ih u status='expired', oslobađa roomId.
   * Arhitektura pogl. 15 i SQL uzorak u 0002_package_integration.sql
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async runTtlSweep() {
    try {
      const expired = await this.reservationsService.expireHeldReservations();
      if (expired > 0) {
        this.logger.log(`TTL Sweep: isteklo ${expired} held rezervacija.`);
      }
    } catch (err) {
      this.logger.error('TTL Sweep greška:', err);
    }
  }

  // ─── Night Audit — svaki dan u 03:00 ─────────────────────────────────────
  /**
   * Noćni audit — automatski se pokreće u 03:00.
   * Zadaci:
   *  1. Knjiženje noćenja (accommodation charge) za sve checked_in rezervacije
   *  2. GL journal entries za sve folio stavke poslovnog dana (pogl. 21)
   *  3. Upis dnevnog occupancy snapshot-a
   *  4. Prebacivanje rezervacija koje su imale checkout danas u "checked_out" (no-show logika)
   */
  @Cron('0 3 * * *', { timeZone: 'Europe/Belgrade' })
  async runNightAudit() {
    this.logger.log('Noćni audit — pokretanje...');

    try {
      const businessDate = this.getYesterdayBusinessDate();
      const properties = await this.prisma.property.findMany({ select: { id: true, currency: true } });

      for (const property of properties) {
        await this.processNightAuditForProperty(property.id, property.currency, businessDate);
      }

      this.logger.log(`Noćni audit završen za datum ${businessDate.toISOString().split('T')[0]}`);
    } catch (err) {
      this.logger.error('Noćni audit greška:', err);
    }
  }

  private getYesterdayBusinessDate(): Date {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    return yesterday;
  }

  private async processNightAuditForProperty(
    propertyId: string,
    currency: string,
    businessDate: Date,
  ) {
    // 1. Pronađi sve active checked-in rezervacije
    const activeReservations = await this.prisma.reservation.findMany({
      where: {
        propertyId,
        status: 'checked_in',
        checkIn: { lte: businessDate },
        checkOut: { gt: businessDate },
      },
      include: {
        ratePlan: true,
      },
    });

    let chargesPosted = 0;

    for (const res of activeReservations) {
      // Uzmi cenu za tu noć
      const rate = await this.prisma.rate.findFirst({
        where: {
          ratePlanId: res.ratePlanId ?? undefined,
          roomTypeId: res.roomTypeId,
          stayDate: businessDate,
        },
      });

      const pricePerNight = rate ? Number(rate.price) : 0;

      if (pricePerNight > 0) {
        await this.foliosService.postNightlyCharges(
          propertyId,
          res.id,
          businessDate,
          pricePerNight,
          currency,
        );
        chargesPosted++;
      }
    }

    // 2. GL journal entries — pokriva i noćenja iz koraka 1 i F&B/ostale
    // stavke knjižene tokom dana (npr. post-to-room iz M11).
    const journaled = await this.financeService.postJournalEntriesForDate(propertyId, businessDate);

    // 3. Upis occupancy snapshot za sobe
    const [totalRooms, occupiedRooms, availableRooms] = await Promise.all([
      this.prisma.room.count({ where: { propertyId, outOfOrder: false, outOfService: false } }),
      this.prisma.room.count({ where: { propertyId, occupancyStatus: 'occupied', outOfOrder: false, outOfService: false } }),
      this.prisma.room.count({
        where: {
          propertyId,
          occupancyStatus: 'vacant',
          cleanlinessStatus: { in: ['clean', 'inspected'] },
          outOfOrder: false,
          outOfService: false,
        },
      }),
    ]);

    await this.prisma.occupancySnapshotDaily.upsert({
      where: {
        propertyId_resourceType_resourceCategory_snapshotDate: {
          propertyId,
          resourceType: 'ROOM',
          resourceCategory: 'ALL',
          snapshotDate: businessDate,
        },
      },
      update: { totalUnits: totalRooms, occupiedUnits: occupiedRooms, availableUnits: availableRooms, source: 'night_audit' },
      create: {
        propertyId,
        resourceType: 'ROOM',
        resourceCategory: 'ALL',
        snapshotDate: businessDate,
        totalUnits: totalRooms,
        occupiedUnits: occupiedRooms,
        availableUnits: availableRooms,
        source: 'night_audit',
      },
    });

    // 4. No-show procesuiranje — rezervacije koje su trebale da dođu juče a nisu
    const noShowReservations = await this.prisma.reservation.findMany({
      where: {
        propertyId,
        status: { in: ['booked', 'confirmed'] },
        checkIn: { lte: businessDate },
        checkOut: { gt: businessDate },
      },
      select: { id: true },
    });

    for (const res of noShowReservations) {
      await this.prisma.reservation.update({
        where: { id: res.id },
        data: { status: 'no_show' },
      });
      await this.prisma.reservationStatusEvent.create({
        data: {
          reservationId: res.id,
          fromStatus: 'confirmed',
          toStatus: 'no_show',
          actorType: 'system',
          note: 'Noćni audit — automatski no-show',
        },
      });
    }

    this.logger.log(
      `Property ${propertyId}: ${chargesPosted} noćenja knjižena, ${journaled} GL stavki proknjiženo, ` +
      `${noShowReservations.length} no-show označenih, snapshot upisan.`,
    );
  }

  // ─── Ručno pokretanje (za testiranje) ─────────────────────────────────────

  async runTtlSweepManual(): Promise<{ expired: number }> {
    const expired = await this.reservationsService.expireHeldReservations();
    return { expired };
  }

  async runNightAuditManual(businessDateStr?: string): Promise<{ message: string }> {
    const businessDate = businessDateStr
      ? new Date(businessDateStr)
      : this.getYesterdayBusinessDate();

    const properties = await this.prisma.property.findMany({ select: { id: true, currency: true } });

    for (const property of properties) {
      await this.processNightAuditForProperty(property.id, property.currency, businessDate);
    }

    return {
      message: `Noćni audit završen za ${businessDate.toISOString().split('T')[0]}`,
    };
  }
}
