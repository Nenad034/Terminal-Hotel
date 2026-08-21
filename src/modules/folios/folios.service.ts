import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AddChargeDto, AddPaymentDto, VoidChargeDto } from './dto/folio.dto';

@Injectable()
export class FoliosService {
  constructor(private readonly prisma: PrismaService) {}

  private async findFolioById(propertyId: string, folioId: string) {
    const folio = await this.prisma.folio.findFirst({
      where: { id: folioId, propertyId },
      include: {
        lineItems: { where: { voidedAt: null }, orderBy: { chargeDate: 'asc' } },
        payments: { orderBy: { occurredAt: 'asc' } },
      },
    });
    if (!folio) throw new NotFoundException(`Folio ${folioId} nije pronađen.`);
    return folio;
  }

  async getFolioByReservation(propertyId: string, reservationId: string) {
    const folio = await this.prisma.folio.findFirst({
      where: { reservationId, propertyId },
      include: {
        lineItems: {
          orderBy: { chargeDate: 'asc' },
        },
        payments: { orderBy: { occurredAt: 'asc' } },
      },
    });
    if (!folio) throw new NotFoundException(`Folio za rezervaciju ${reservationId} nije pronađen.`);

    // Izračun balansa
    const charged = folio.lineItems
      .filter((li) => !li.voidedAt)
      .reduce((sum, li) => sum + Number(li.totalAmount) + Number(li.taxAmount), 0);
    const paid = folio.payments
      .filter((p) => p.status === 'captured')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    return {
      ...folio,
      summary: {
        totalCharged: Math.round(charged * 100) / 100,
        totalPaid: Math.round(paid * 100) / 100,
        balance: Math.round((charged - paid) * 100) / 100,
      },
    };
  }

  async addCharge(propertyId: string, folioId: string, dto: AddChargeDto) {
    const folio = await this.findFolioById(propertyId, folioId);

    if (folio.status === 'closed') {
      throw new BadRequestException('Ne može se knjižiti na zatvoren folio.');
    }

    const quantity = dto.quantity ?? 1;
    const taxRate = dto.taxRate ?? 0;
    const totalAmount = dto.unitPrice * quantity;
    const taxAmount = totalAmount * taxRate;

    return this.prisma.folioLineItem.create({
      data: {
        folioId,
        chargeDate: new Date(dto.chargeDate),
        description: dto.description,
        revenueCategory: dto.revenueCategory,
        quantity,
        unitPrice: dto.unitPrice,
        totalAmount,
        taxAmount,
        taxRate,
        postedBy: dto.postedBy,
      },
    });
  }

  async voidCharge(propertyId: string, folioId: string, lineItemId: string, dto: VoidChargeDto) {
    const folio = await this.findFolioById(propertyId, folioId);

    if (folio.status === 'closed') {
      throw new BadRequestException('Ne može se stornirati stavka na zatvorenom foliju.');
    }

    const lineItem = folio.lineItems.find((li) => li.id === lineItemId);
    if (!lineItem) throw new NotFoundException(`Stavka ${lineItemId} nije pronađena.`);
    if (lineItem.voidedAt) throw new BadRequestException('Stavka je već stornirana.');

    return this.prisma.folioLineItem.update({
      where: { id: lineItemId },
      data: { voidedAt: new Date() },
    });
  }

  async addPayment(propertyId: string, folioId: string, dto: AddPaymentDto) {
    const folio = await this.findFolioById(propertyId, folioId);

    if (folio.status === 'closed') {
      throw new BadRequestException('Ne može se knjižiti uplata na zatvoren folio.');
    }

    return this.prisma.payment.create({
      data: {
        folioId,
        amount: dto.amount,
        currency: dto.currency ?? folio.currency,
        method: dto.method,
        paymentToken: dto.paymentToken,
        reference: dto.reference,
        status: 'captured',
        postedBy: dto.postedBy,
      },
    });
  }

  /**
   * Knjiženje noćenja na folio — poziva se iz Night Audit workerа.
   * Za svaki dan boravka koji nije već knjižen upisuje accommodation stavku.
   */
  async postNightlyCharges(
    propertyId: string,
    reservationId: string,
    stayDate: Date,
    pricePerNight: number,
    currency: string,
  ) {
    const folio = await this.prisma.folio.findFirst({
      where: { reservationId, propertyId, status: 'open' },
    });

    if (!folio) return null;

    // Proveri da noćenje za ovaj datum već nije knjiženo
    const existing = await this.prisma.folioLineItem.findFirst({
      where: {
        folioId: folio.id,
        chargeDate: stayDate,
        revenueCategory: 'accommodation',
        voidedAt: null,
      },
    });

    if (existing) return existing;

    const taxRate = 0.1; // 10% PDV — konfigurisati po property/rate plan
    const taxAmount = pricePerNight * taxRate;

    return this.prisma.folioLineItem.create({
      data: {
        folioId: folio.id,
        chargeDate: stayDate,
        description: `Noćenje — ${stayDate.toISOString().split('T')[0]}`,
        revenueCategory: 'accommodation',
        quantity: 1,
        unitPrice: pricePerNight,
        totalAmount: pricePerNight,
        taxAmount,
        taxRate,
        postedBy: null, // Sistem
      },
    });
  }
}
