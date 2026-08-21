import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FoliosService } from '../folios/folios.service';
import {
  CreateSpaResourceDto,
  UpdateSpaResourceStatusDto,
  CreateSpaBlockoutDto,
  SpaChargeToRoomDto,
} from './dto/spa.dto';

@Injectable()
export class SpaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly foliosService: FoliosService,
  ) {}

  // ─── Resources (lokalni read-only mirror sistema zapisa, npr. Zenoti — pogl. 29) ──

  async createResource(propertyId: string, dto: CreateSpaResourceDto) {
    return this.prisma.spaResource.create({
      data: {
        propertyId,
        name: dto.name,
        capacity: dto.capacity ?? 1,
        canExceedCapacity: dto.canExceedCapacity ?? false,
        roomCategory: dto.roomCategory,
        externalRef: dto.externalRef,
        status: { create: { status: 'available' } },
      },
      include: { status: true },
    });
  }

  async findResources(propertyId: string) {
    return this.prisma.spaResource.findMany({
      where: { propertyId },
      include: { status: true },
      orderBy: { name: 'asc' },
    });
  }

  private async findResourceOrThrow(propertyId: string, resourceId: string) {
    const resource = await this.prisma.spaResource.findFirst({
      where: { id: resourceId, propertyId },
      include: { status: true },
    });
    if (!resource) throw new NotFoundException(`Spa resurs ${resourceId} nije pronađen.`);
    return resource;
  }

  async updateResourceStatus(propertyId: string, resourceId: string, dto: UpdateSpaResourceStatusDto) {
    await this.findResourceOrThrow(propertyId, resourceId);
    return this.prisma.spaResourceStatus.upsert({
      where: { spaResourceId: resourceId },
      update: {
        status: dto.status,
        statusSince: new Date(),
        currentAppointmentReference: dto.currentAppointmentReference,
      },
      create: {
        spaResourceId: resourceId,
        status: dto.status,
        currentAppointmentReference: dto.currentAppointmentReference,
      },
    });
  }

  // ─── Blockouts ──────────────────────────────────────────────────────────────

  async createBlockout(propertyId: string, resourceId: string, dto: CreateSpaBlockoutDto) {
    await this.findResourceOrThrow(propertyId, resourceId);
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (endAt <= startAt) throw new BadRequestException('endAt mora biti posle startAt.');

    return this.prisma.spaResourceBlockout.create({
      data: { spaResourceId: resourceId, startAt, endAt, reason: dto.reason },
    });
  }

  async findBlockouts(propertyId: string, resourceId: string) {
    await this.findResourceOrThrow(propertyId, resourceId);
    return this.prisma.spaResourceBlockout.findMany({
      where: { spaResourceId: resourceId },
      orderBy: { startAt: 'asc' },
    });
  }

  // ─── Naplata na sobu (isti obrazac kao M11 post-to-room) ────────────────────

  async chargeToRoom(propertyId: string, dto: SpaChargeToRoomDto) {
    const room = await this.prisma.room.findFirst({ where: { propertyId, roomNumber: dto.roomNumber } });
    if (!room) throw new NotFoundException(`Soba '${dto.roomNumber}' nije pronađena.`);

    const reservation = await this.prisma.reservation.findFirst({
      where: { propertyId, roomId: room.id, status: 'checked_in' },
      orderBy: { checkIn: 'desc' },
    });
    if (!reservation) {
      throw new BadRequestException(
        `Nema gosta prijavljenog (checked_in) u sobi '${dto.roomNumber}' — naplata na sobu nije moguća.`,
      );
    }

    const folio = await this.prisma.folio.findFirst({
      where: { reservationId: reservation.id, propertyId, status: 'open' },
    });
    if (!folio) throw new BadRequestException(`Otvoren folio za sobu '${dto.roomNumber}' nije pronađen.`);

    return this.foliosService.addCharge(propertyId, folio.id, {
      chargeDate: new Date().toISOString().split('T')[0],
      description: dto.description,
      revenueCategory: 'spa',
      unitPrice: dto.amount,
      taxRate: dto.taxRate ?? 0.2,
      postedBy: dto.postedBy,
    });
  }
}
