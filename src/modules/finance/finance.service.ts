import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

// Kanonski GL kontni plan (pogl. 21/22) — po vendoru se preslikava kroz
// pluggable export adapter (QuickBooks/Xero/M3), ovo je interni standard.
export const GL_ACCOUNTS = {
  GUEST_LEDGER: '1100-GUEST-LEDGER',
  VAT_PAYABLE: '2200-VAT-PAYABLE',
  ROOMS_REVENUE: '4000-ROOMS',
  FNB_REVENUE: '4100-FNB',
  OTHER_REVENUE: '4900-OTHER',
} as const;

const REVENUE_ACCOUNTS = [GL_ACCOUNTS.ROOMS_REVENUE, GL_ACCOUNTS.FNB_REVENUE, GL_ACCOUNTS.OTHER_REVENUE];

function revenueAccountFor(revenueCategory: string): string {
  if (revenueCategory === 'accommodation') return GL_ACCOUNTS.ROOMS_REVENUE;
  if (revenueCategory === 'fnb') return GL_ACCOUNTS.FNB_REVENUE;
  return GL_ACCOUNTS.OTHER_REVENUE;
}

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generiše JournalEntry redove za sve folio stavke knjižene na dati poslovni
   * datum koje još nisu proknjižene (pogl. 21: "PMS emituje kanoničan journal
   * entry event pri noćnom auditu"). Idempotentno — poziva se iz noćnog audita,
   * ali preskače stavke koje već imaju JournalEntry sa sourceReference.
   */
  async postJournalEntriesForDate(propertyId: string, businessDate: Date): Promise<number> {
    const lineItems = await this.prisma.folioLineItem.findMany({
      where: {
        chargeDate: businessDate,
        voidedAt: null,
        folio: { propertyId },
        journalEntries: { none: {} },
      },
      include: { folio: { select: { propertyId: true } } },
    });

    let posted = 0;
    for (const item of lineItems) {
      const total = Number(item.totalAmount);
      const tax = Number(item.taxAmount);
      const gross = total + tax;
      const revenueAccount = revenueAccountFor(item.revenueCategory);

      await this.prisma.$transaction(async (tx) => {
        await tx.journalEntry.create({
          data: {
            propertyId,
            businessDate,
            glAccountCode: GL_ACCOUNTS.GUEST_LEDGER,
            debitAmount: gross,
            creditAmount: 0,
            department: item.revenueCategory,
            description: item.description,
            sourceReference: item.id,
          },
        });
        await tx.journalEntry.create({
          data: {
            propertyId,
            businessDate,
            glAccountCode: revenueAccount,
            debitAmount: 0,
            creditAmount: total,
            department: item.revenueCategory,
            description: item.description,
            sourceReference: item.id,
          },
        });
        if (tax > 0) {
          await tx.journalEntry.create({
            data: {
              propertyId,
              businessDate,
              glAccountCode: GL_ACCOUNTS.VAT_PAYABLE,
              debitAmount: 0,
              creditAmount: tax,
              department: item.revenueCategory,
              description: `PDV — ${item.description}`,
              sourceReference: item.id,
            },
          });
        }
      });
      posted++;
    }

    if (posted > 0) {
      this.logger.log(`Property ${propertyId}: ${posted} folio stavki proknjiženo u GL za ${businessDate.toISOString().split('T')[0]}.`);
    }
    return posted;
  }

  async findJournalEntries(propertyId: string, from?: Date, to?: Date, exported?: boolean) {
    return this.prisma.journalEntry.findMany({
      where: {
        propertyId,
        ...(from && to ? { businessDate: { gte: from, lte: to } } : {}),
        ...(exported !== undefined ? { exportedAt: exported ? { not: null } : null } : {}),
      },
      orderBy: [{ businessDate: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Batch export — isti adapter princip kao fiskalizacija/SEF (pogl. 17/21):
   * PMS ne zove GL sistem uživo, samo označava red kao izvezen. Stvarni adapter
   * (QuickBooks/Xero/M3) čita ovaj batch i piše u knjigovodstveni sistem.
   */
  async exportJournalBatch(propertyId: string, from?: Date, to?: Date) {
    const entries = await this.findJournalEntries(propertyId, from, to, false);
    if (entries.length === 0) return { exportedCount: 0, entries: [] };

    await this.prisma.journalEntry.updateMany({
      where: { id: { in: entries.map((e) => e.id) } },
      data: { exportedAt: new Date() },
    });

    return { exportedCount: entries.length, entries };
  }

  /**
   * Standardne USALI/HFTP formule (pogl. 21). "Raspoložive sobe" = ukupan
   * sellable inventar (totalUnits iz snapshot-a, već isključuje OOO/OOS) —
   * ne meša se sa "trenutno slobodnih i čistih" (availableUnits polje, koje
   * služi front desk/housekeeping prikazu, ne KPI imeniocu).
   */
  async getKpi(propertyId: string, from: Date, to: Date) {
    const snapshots = await this.prisma.occupancySnapshotDaily.findMany({
      where: {
        propertyId,
        resourceType: 'ROOM',
        resourceCategory: 'ALL',
        snapshotDate: { gte: from, lte: to },
      },
    });

    const soldRoomNights = snapshots.reduce((sum, s) => sum + s.occupiedUnits, 0);
    const availableRoomNights = snapshots.reduce((sum, s) => sum + s.totalUnits, 0);

    const revenueEntries = await this.prisma.journalEntry.groupBy({
      by: ['glAccountCode'],
      where: {
        propertyId,
        businessDate: { gte: from, lte: to },
        glAccountCode: { in: REVENUE_ACCOUNTS },
      },
      _sum: { creditAmount: true },
    });

    const revenueByAccount: Record<string, number> = {};
    for (const r of revenueEntries) {
      revenueByAccount[r.glAccountCode] = Number(r._sum.creditAmount ?? 0);
    }
    const roomRevenue = revenueByAccount[GL_ACCOUNTS.ROOMS_REVENUE] ?? 0;
    const totalRevenue = REVENUE_ACCOUNTS.reduce((sum, acc) => sum + (revenueByAccount[acc] ?? 0), 0);

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const occupancyPercent = availableRoomNights > 0 ? soldRoomNights / availableRoomNights : 0;
    const adr = soldRoomNights > 0 ? roomRevenue / soldRoomNights : 0;
    const revpar = availableRoomNights > 0 ? roomRevenue / availableRoomNights : 0;
    const trevpar = availableRoomNights > 0 ? totalRevenue / availableRoomNights : 0;

    return {
      period: { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] },
      inputs: { soldRoomNights, availableRoomNights, roomRevenue: round2(roomRevenue), totalRevenue: round2(totalRevenue) },
      kpi: {
        occupancyPercent: round2(occupancyPercent * 100),
        adr: round2(adr),
        revpar: round2(revpar),
        trevpar: round2(trevpar),
        goppar: null, // Zahteva praćenje rashoda po odeljenju — nije u obimu v1 (pogl. 21).
      },
    };
  }
}
