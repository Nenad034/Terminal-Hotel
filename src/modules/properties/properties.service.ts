import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateOrganizationDto, CreatePropertyDto, UpdatePropertyDto } from './dto/property.dto';

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Organizations ─────────────────────────────────────────────────────────

  async createOrganization(dto: CreateOrganizationDto) {
    return this.prisma.organization.create({ data: dto });
  }

  async findAllOrganizations() {
    return this.prisma.organization.findMany({
      include: { _count: { select: { properties: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOrganizationById(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: { properties: true },
    });
    if (!org) throw new NotFoundException(`Organizacija ${id} nije pronađena.`);
    return org;
  }

  // ─── Properties ────────────────────────────────────────────────────────────

  async createProperty(organizationId: string, dto: CreatePropertyDto) {
    // Proveri da organizacija postoji
    await this.findOrganizationById(organizationId);

    return this.prisma.property.create({
      data: {
        organizationId,
        name: dto.name,
        timezone: dto.timezone,
        currency: dto.currency,
        address: dto.address ?? {},
      },
    });
  }

  async findPropertyById(propertyId: string) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        organization: true,
        _count: {
          select: {
            rooms: true,
            ratePlans: true,
            reservations: true,
          },
        },
      },
    });
    if (!property) throw new NotFoundException(`Objekat ${propertyId} nije pronađen.`);
    return property;
  }

  async findPropertiesByOrganization(organizationId: string) {
    return this.prisma.property.findMany({
      where: { organizationId },
      include: { _count: { select: { rooms: true, reservations: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async updateProperty(propertyId: string, dto: UpdatePropertyDto) {
    await this.findPropertyById(propertyId);
    return this.prisma.property.update({
      where: { id: propertyId },
      data: dto,
    });
  }

  // ─── Property Stats ─────────────────────────────────────────────────────────

  async getPropertyStats(propertyId: string) {
    await this.findPropertyById(propertyId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalRooms, availableRooms, todayArrivals, todayDepartures, openReservations] =
      await Promise.all([
        this.prisma.room.count({ where: { propertyId } }),
        this.prisma.room.count({
          where: {
            propertyId,
            occupancyStatus: 'vacant',
            cleanlinessStatus: { in: ['clean', 'inspected'] },
            outOfOrder: false,
            outOfService: false,
          },
        }),
        this.prisma.reservation.count({
          where: {
            propertyId,
            status: { in: ['confirmed', 'booked'] },
            checkIn: { gte: today, lt: new Date(today.getTime() + 86400000) },
          },
        }),
        this.prisma.reservation.count({
          where: {
            propertyId,
            status: 'checked_in',
            checkOut: { gte: today, lt: new Date(today.getTime() + 86400000) },
          },
        }),
        this.prisma.reservation.count({
          where: { propertyId, status: { in: ['checked_in', 'booked', 'confirmed'] } },
        }),
      ]);

    return {
      propertyId,
      totalRooms,
      availableRooms,
      occupiedRooms: totalRooms - availableRooms,
      occupancyRate: totalRooms > 0 ? Math.round((totalRooms - availableRooms) / totalRooms * 100) : 0,
      todayArrivals,
      todayDepartures,
      openReservations,
      asOf: new Date().toISOString(),
    };
  }
}
