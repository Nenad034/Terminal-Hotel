import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateFunctionSpaceDto,
  CreateFunctionSpaceBookingDto,
  UpdateFunctionSpaceBookingStatusDto,
} from './dto/mice.dto';

@Injectable()
export class MiceService {
  constructor(private readonly prisma: PrismaService) {}

  async createFunctionSpace(propertyId: string, dto: CreateFunctionSpaceDto) {
    return this.prisma.functionSpace.create({
      data: { propertyId, name: dto.name, capacityBySetup: dto.capacityBySetup ?? {} },
    });
  }

  async findFunctionSpaces(propertyId: string) {
    return this.prisma.functionSpace.findMany({
      where: { propertyId },
      include: { _count: { select: { bookings: true } } },
      orderBy: { name: 'asc' },
    });
  }

  private async findFunctionSpaceOrThrow(propertyId: string, functionSpaceId: string) {
    const space = await this.prisma.functionSpace.findFirst({
      where: { id: functionSpaceId, propertyId },
    });
    if (!space) throw new NotFoundException(`Kongresna sala ${functionSpaceId} nije pronađena.`);
    return space;
  }

  async createBooking(propertyId: string, functionSpaceId: string, dto: CreateFunctionSpaceBookingDto) {
    await this.findFunctionSpaceOrThrow(propertyId, functionSpaceId);

    const bufferBefore = dto.bufferBeforeMin ?? 0;
    const bufferAfter = dto.bufferAfterMin ?? 0;
    const rawStartAt = new Date(dto.startAt);
    const rawEndAt = new Date(dto.endAt);
    const effectiveStart = new Date(rawStartAt.getTime() - bufferBefore * 60000);
    const effectiveEnd = new Date(rawEndAt.getTime() + bufferAfter * 60000);
    if (rawEndAt <= rawStartAt) throw new BadRequestException('endAt mora biti posle startAt.');

    // Provera preklapanja (uz buffer NA OBE STRANE — i nove i postojećih
    // rezervacija, svaka sa sopstvenim bufferom) — samo protiv definite/tentative.
    const candidates = await this.prisma.functionSpaceBooking.findMany({
      where: {
        functionSpaceId,
        status: { in: ['tentative', 'definite'] },
      },
    });
    const overlapping = candidates.find((c) => {
      const existingStart = new Date(c.startAt.getTime() - c.bufferBeforeMin * 60000);
      const existingEnd = new Date(c.endAt.getTime() + c.bufferAfterMin * 60000);
      return existingStart < effectiveEnd && existingEnd > effectiveStart;
    });
    if (overlapping) {
      throw new BadRequestException(
        `Sala je već zauzeta (uz buffer) u traženom periodu — konflikt sa rezervacijom ${overlapping.id}.`,
      );
    }

    return this.prisma.functionSpaceBooking.create({
      data: {
        functionSpaceId,
        eventReference: dto.eventReference,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        setupType: dto.setupType,
        bufferBeforeMin: bufferBefore,
        bufferAfterMin: bufferAfter,
      },
    });
  }

  async findBookings(propertyId: string, functionSpaceId: string) {
    await this.findFunctionSpaceOrThrow(propertyId, functionSpaceId);
    return this.prisma.functionSpaceBooking.findMany({
      where: { functionSpaceId },
      orderBy: { startAt: 'asc' },
    });
  }

  async updateBookingStatus(propertyId: string, bookingId: string, dto: UpdateFunctionSpaceBookingStatusDto) {
    const booking = await this.prisma.functionSpaceBooking.findFirst({
      where: { id: bookingId, functionSpace: { propertyId } },
    });
    if (!booking) throw new NotFoundException(`Rezervacija sale ${bookingId} nije pronađena.`);

    return this.prisma.functionSpaceBooking.update({
      where: { id: bookingId },
      data: { status: dto.status },
    });
  }
}
