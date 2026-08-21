import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateEturistaBatchDto } from './dto/rs-compliance.dto';

/**
 * eTurista (eturista.gov.rs) — obavezna prijava gostiju + boravišna taksa.
 * Batch integracija je dovoljna (arhitektura pogl. 17: do 26h za integrisane
 * sisteme naspram 2h ručno) — ovaj servis sastavlja batch iz odjavljenih
 * rezervacija u periodu; stvarni submit ka eTurista API-ju je stub.
 * Boravišna taksa se obračunava samo po odraslom gostu/noći (property.tourist_tax_per_night)
 * — pojednostavljenje, jer šema ne modeluje kategorije oslobođenja (deca, invaliditet i sl.).
 */
@Injectable()
export class EturistaService {
  constructor(private readonly prisma: PrismaService) {}

  async createBatch(propertyId: string, dto: CreateEturistaBatchDto) {
    const property = await this.prisma.property.findUniqueOrThrow({ where: { id: propertyId } });
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);

    const reservations = await this.prisma.reservation.findMany({
      where: {
        propertyId,
        status: 'checked_out',
        checkOut: { gte: periodStart, lte: periodEnd },
      },
      include: { primaryGuest: true },
      orderBy: { checkOut: 'asc' },
    });

    if (reservations.length === 0) {
      throw new BadRequestException('Nema odjavljenih rezervacija u zadatom periodu — nema šta da se prijavi.');
    }

    const touristTaxPerNight = Number(property.touristTaxPerNight);
    let touristTaxTotal = 0;

    const payload = reservations.map((r) => {
      const nights = Math.max(
        0,
        Math.round((r.checkOut.getTime() - r.checkIn.getTime()) / (1000 * 60 * 60 * 24)),
      );
      const tax = nights * r.adults * touristTaxPerNight;
      touristTaxTotal += tax;

      return {
        reservationId: r.id,
        confirmationNumber: r.confirmationNumber,
        guestName: `${r.primaryGuest.firstName} ${r.primaryGuest.lastName}`,
        idDocumentType: r.primaryGuest.idDocumentType,
        idDocumentNumber: r.primaryGuest.idDocumentNumber,
        nationality: r.primaryGuest.nationality,
        checkIn: r.checkIn.toISOString().split('T')[0],
        checkOut: r.checkOut.toISOString().split('T')[0],
        nights,
        adults: r.adults,
        children: r.children,
        touristTax: Number(tax.toFixed(2)),
      };
    });

    return this.prisma.eturistaBatch.create({
      data: {
        propertyId,
        periodStart,
        periodEnd,
        guestCount: reservations.length,
        touristTaxTotal: Number(touristTaxTotal.toFixed(2)),
        status: 'pending',
        payload,
      },
    });
  }

  async submitBatch(propertyId: string, batchId: string) {
    const batch = await this.prisma.eturistaBatch.findFirst({ where: { id: batchId, propertyId } });
    if (!batch) throw new NotFoundException(`eTurista batch ${batchId} nije pronađen.`);
    if (batch.status !== 'pending') {
      throw new BadRequestException(`Batch je već u statusu '${batch.status}'.`);
    }

    return this.prisma.eturistaBatch.update({
      where: { id: batchId },
      data: { status: 'submitted', submittedAt: new Date() },
    });
  }

  findBatches(propertyId: string) {
    return this.prisma.eturistaBatch.findMany({
      where: { propertyId },
      orderBy: { periodStart: 'desc' },
    });
  }

  async findBatchById(propertyId: string, batchId: string) {
    const batch = await this.prisma.eturistaBatch.findFirst({ where: { id: batchId, propertyId } });
    if (!batch) throw new NotFoundException(`eTurista batch ${batchId} nije pronađen.`);
    return batch;
  }
}
