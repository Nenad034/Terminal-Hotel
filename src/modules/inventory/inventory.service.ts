import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateVendorDto, CreateLocationDto, CreateItemDto } from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Vendors ────────────────────────────────────────────────────────────────

  async createVendor(propertyId: string, dto: CreateVendorDto) {
    return this.prisma.vendor.create({
      data: {
        propertyId,
        name: dto.name,
        contactName: dto.contactName,
        email: dto.email,
        phone: dto.phone,
      },
    });
  }

  async findVendors(propertyId: string) {
    return this.prisma.vendor.findMany({
      where: { propertyId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  // ─── Locations ──────────────────────────────────────────────────────────────

  async createLocation(propertyId: string, dto: CreateLocationDto) {
    if (dto.parentLocationId) {
      const parent = await this.prisma.inventoryLocation.findFirst({
        where: { id: dto.parentLocationId, propertyId },
      });
      if (!parent) throw new NotFoundException(`Roditeljska lokacija ${dto.parentLocationId} nije pronađena.`);
    }
    return this.prisma.inventoryLocation.create({
      data: {
        propertyId,
        name: dto.name,
        locationType: dto.locationType,
        parentLocationId: dto.parentLocationId,
      },
    });
  }

  async findLocations(propertyId: string) {
    return this.prisma.inventoryLocation.findMany({
      where: { propertyId },
      include: { _count: { select: { childLocations: true, stockLevels: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findLocationStock(propertyId: string, locationId: string) {
    const location = await this.prisma.inventoryLocation.findFirst({
      where: { id: locationId, propertyId },
    });
    if (!location) throw new NotFoundException(`Lokacija ${locationId} nije pronađena.`);

    return this.prisma.stockLevel.findMany({
      where: { locationId },
      include: { item: { select: { sku: true, name: true, unit: true, costPerUnit: true } } },
      orderBy: { item: { name: 'asc' } },
    });
  }

  // ─── Items ──────────────────────────────────────────────────────────────────

  async createItem(propertyId: string, dto: CreateItemDto) {
    const existing = await this.prisma.inventoryItem.findUnique({
      where: { propertyId_sku: { propertyId, sku: dto.sku } },
    });
    if (existing) throw new ConflictException(`Artikal sa SKU '${dto.sku}' već postoji.`);

    return this.prisma.inventoryItem.create({
      data: {
        propertyId,
        sku: dto.sku,
        name: dto.name,
        unit: dto.unit,
        category: dto.category,
        reorderLevel: dto.reorderLevel,
      },
    });
  }

  async findItems(propertyId: string) {
    return this.prisma.inventoryItem.findMany({
      where: { propertyId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findItemById(propertyId: string, itemId: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: itemId, propertyId },
      include: { stockLevels: { include: { location: { select: { name: true } } } } },
    });
    if (!item) throw new NotFoundException(`Artikal ${itemId} nije pronađen.`);
    return item;
  }
}
