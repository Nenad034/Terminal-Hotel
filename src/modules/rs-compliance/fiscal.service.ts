import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Prisma, FolioLineItem } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

type TxClient = Prisma.TransactionClient;

/**
 * Fiskalizacija (pogl. 17): sinhron poziv pri svakoj naplati preko PFR-a
 * (L-PFR lokalno / V-PFR virtuelno). Ovo je pluggable stub adapter — pravi
 * PFR uređaj/servis nije integrisan (nema sertifikovanog pristupa u ovom
 * okruženju). Fiskalni broj i QR kod su simulirani, ali oblik odgovora i
 * mesto poziva (sinhrono, unutar iste transakcije kao knjiženje uplate)
 * odgovaraju stvarnoj integraciji.
 */
@Injectable()
export class FiscalService {
  constructor(private readonly prisma: PrismaService) {}

  private computeVatBreakdown(lineItems: FolioLineItem[], amount: number): Record<string, number> {
    const totalCharged = lineItems.reduce((sum, li) => sum + Number(li.totalAmount), 0);
    const breakdown: Record<string, number> = {};

    if (totalCharged <= 0) {
      // Nema otvorenih stavki na foliju (npr. avansna uplata/depozit) — koristi standardnu PDV stopu.
      breakdown['20%'] = Number((amount - amount / 1.2).toFixed(2));
      return breakdown;
    }

    for (const li of lineItems) {
      const rate = Number(li.taxRate);
      const rateKey = `${(rate * 100).toFixed(0)}%`;
      const share = Number(li.totalAmount) / totalCharged;
      const allocatedAmount = amount * share;
      const vat = rate > 0 ? allocatedAmount - allocatedAmount / (1 + rate) : 0;
      breakdown[rateKey] = Number(((breakdown[rateKey] ?? 0) + vat).toFixed(2));
    }
    return breakdown;
  }

  /**
   * Izdaje fiskalni račun za uplatu. Poziva se sinhrono iz FoliosService.addPayment,
   * u istoj transakciji — ako PFR poziv (ovde stub) ne uspe, cela uplata se odbija,
   * jer je fiskalizacija zakonski uslov naplate u RS.
   *
   * VAT breakdown je proporcionalna alokacija PDV stopa otvorenih stavki foliju na
   * iznos uplate (šema ne modeluje eksplicitnu vezu uplata↔stavka) — pojednostavljenje
   * dokumentovano jer prava PFR integracija dobija stavke direktno sa POS/folio korpe.
   */
  async issueForPayment(
    tx: TxClient,
    propertyId: string,
    folioId: string,
    paymentId: string,
    amount: number,
    lineItems: FolioLineItem[],
  ) {
    const fiscalNumber = `PFR-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const qrCode = `https://suf.purs.gov.rs/v/?vl=${randomBytes(16).toString('hex')}`;
    const vatBreakdown = this.computeVatBreakdown(lineItems, amount);

    return tx.fiscalDocument.create({
      data: {
        propertyId,
        folioId,
        paymentId,
        pfrType: 'V-PFR',
        fiscalNumber,
        totalAmount: amount,
        vatBreakdown,
        qrCode,
        status: 'issued',
        rawResponse: { simulated: true, provider: 'stub-pfr', requestedAt: new Date().toISOString() },
      },
    });
  }

  findByFolio(propertyId: string, folioId: string) {
    return this.prisma.fiscalDocument.findMany({
      where: { propertyId, folioId },
      orderBy: { issuedAt: 'desc' },
    });
  }
}
