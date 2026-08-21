import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { CreateSefInvoiceDto } from './dto/rs-compliance.dto';

/**
 * SEF e-Faktura (efaktura.gov.rs) — B2B/B2G fakturisanje, obavezno od 1.4.2026
 * za firme iznad praga. Zaseban adapter od fiskalizacije (pogl. 17). Pravi SEF
 * API poziv (UBL XML preko SEF gateway-a) nije integrisan — stub simulira
 * submit i naknadni status.
 */
@Injectable()
export class SefService {
  constructor(private readonly prisma: PrismaService) {}

  async createInvoice(propertyId: string, dto: CreateSefInvoiceDto) {
    const folio = await this.prisma.folio.findFirst({
      where: { id: dto.folioId, propertyId },
      include: { lineItems: { where: { voidedAt: null } } },
    });
    if (!folio) throw new NotFoundException(`Folio ${dto.folioId} nije pronađen.`);

    const totalAmount = folio.lineItems.reduce(
      (sum, li) => sum + Number(li.totalAmount) + Number(li.taxAmount),
      0,
    );
    if (totalAmount <= 0) {
      throw new BadRequestException('Folio nema knjiženih stavki — nema šta da se fakturiše.');
    }

    const invoiceNumber = `SEF-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;

    return this.prisma.sefInvoice.create({
      data: {
        propertyId,
        folioId: dto.folioId,
        corporateAccountId: dto.corporateAccountId,
        invoiceNumber,
        totalAmount: Number(totalAmount.toFixed(2)),
        status: 'draft',
      },
    });
  }

  async submitInvoice(propertyId: string, invoiceId: string) {
    const invoice = await this.prisma.sefInvoice.findFirst({ where: { id: invoiceId, propertyId } });
    if (!invoice) throw new NotFoundException(`SEF faktura ${invoiceId} nije pronađena.`);
    if (invoice.status !== 'draft') {
      throw new BadRequestException(`Faktura je već u statusu '${invoice.status}'.`);
    }

    return this.prisma.sefInvoice.update({
      where: { id: invoiceId },
      data: {
        status: 'submitted',
        submittedAt: new Date(),
        sefResponse: { simulated: true, sefId: randomBytes(8).toString('hex'), acceptedFormat: 'UBL 2.1' },
      },
    });
  }

  findInvoices(propertyId: string) {
    return this.prisma.sefInvoice.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findInvoiceById(propertyId: string, invoiceId: string) {
    const invoice = await this.prisma.sefInvoice.findFirst({ where: { id: invoiceId, propertyId } });
    if (!invoice) throw new NotFoundException(`SEF faktura ${invoiceId} nije pronađena.`);
    return invoice;
  }
}
