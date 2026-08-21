import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderStatusDto,
  CreateReceiptDto,
  CreateTransferDto,
  CreateDepletionDto,
} from './dto/inventory.dto';

@Injectable()
export class ProcurementService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Purchase Orders ────────────────────────────────────────────────────────

  async createPurchaseOrder(propertyId: string, dto: CreatePurchaseOrderDto) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: dto.vendorId, propertyId },
    });
    if (!vendor) throw new NotFoundException(`Dobavljač ${dto.vendorId} nije pronađen.`);

    return this.prisma.purchaseOrder.create({
      data: {
        propertyId,
        vendorId: dto.vendorId,
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : undefined,
        lines: {
          create: dto.lines.map((l) => ({
            itemId: l.itemId,
            quantityOrdered: l.quantityOrdered,
            unitCost: l.unitCost,
          })),
        },
      },
      include: { lines: { include: { item: { select: { sku: true, name: true } } } }, vendor: true },
    });
  }

  async findPurchaseOrders(propertyId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { propertyId },
      include: { vendor: { select: { name: true } }, lines: true },
      orderBy: { orderDate: 'desc' },
    });
  }

  private async findPurchaseOrderOrThrow(propertyId: string, poId: string) {
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id: poId, propertyId } });
    if (!po) throw new NotFoundException(`Narudžbenica ${poId} nije pronađena.`);
    return po;
  }

  async findPurchaseOrderById(propertyId: string, poId: string) {
    await this.findPurchaseOrderOrThrow(propertyId, poId);
    return this.prisma.purchaseOrder.findFirst({
      where: { id: poId, propertyId },
      include: {
        vendor: true,
        lines: { include: { item: { select: { sku: true, name: true, unit: true } } } },
        receipts: { include: { lines: true } },
      },
    });
  }

  async updatePurchaseOrderStatus(propertyId: string, poId: string, dto: UpdatePurchaseOrderStatusDto) {
    const po = await this.findPurchaseOrderOrThrow(propertyId, poId);
    if (po.status === 'received' || po.status === 'cancelled') {
      throw new BadRequestException(`Narudžbenica u statusu '${po.status}' se ne može više menjati.`);
    }
    return this.prisma.purchaseOrder.update({ where: { id: poId }, data: { status: dto.status } });
  }

  // ─── Receipts (3-way match: PO ↔ Receipt ↔ Invoice van obima v1) ────────────

  async createReceipt(propertyId: string, dto: CreateReceiptDto) {
    if (dto.purchaseOrderId) {
      const po = await this.findPurchaseOrderOrThrow(propertyId, dto.purchaseOrderId);
      if (po.status === 'received' || po.status === 'cancelled') {
        throw new BadRequestException(`Narudžbenica u statusu '${po.status}' ne može više primati robu.`);
      }
    }
    const location = await this.prisma.inventoryLocation.findFirst({
      where: { id: dto.locationId, propertyId },
    });
    if (!location) throw new NotFoundException(`Lokacija ${dto.locationId} nije pronađena.`);

    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.receipt.create({
        data: {
          purchaseOrderId: dto.purchaseOrderId,
          locationId: dto.locationId,
          receivedBy: dto.receivedBy,
          lines: {
            create: dto.lines.map((l) => ({
              itemId: l.itemId,
              quantityReceived: l.quantityReceived,
              unitCost: l.unitCost,
            })),
          },
        },
        include: { lines: true },
      });

      for (const line of dto.lines) {
        // Priliv na StockLevel (upsert po item+lokacija).
        await tx.stockLevel.upsert({
          where: { itemId_locationId: { itemId: line.itemId, locationId: dto.locationId } },
          update: { quantityOnHand: { increment: line.quantityReceived } },
          create: {
            itemId: line.itemId,
            locationId: dto.locationId,
            quantityOnHand: line.quantityReceived,
          },
        });

        // Cena recepture mora se automatski preračunati pri novoj fakturi (pogl. 6) —
        // last-cost metoda za v1: costPerUnit prati cenu poslednjeg prijema.
        await tx.inventoryItem.update({
          where: { id: line.itemId },
          data: { costPerUnit: line.unitCost },
        });
      }

      if (dto.purchaseOrderId) {
        await tx.purchaseOrder.update({
          where: { id: dto.purchaseOrderId },
          data: { status: 'received' },
        });
      }

      return receipt;
    });
  }

  // ─── Transfers ──────────────────────────────────────────────────────────────

  async createTransfer(propertyId: string, dto: CreateTransferDto) {
    if (dto.fromLocationId === dto.toLocationId) {
      throw new BadRequestException('Izvorna i ciljna lokacija moraju biti različite.');
    }
    const [from, to] = await Promise.all([
      this.prisma.inventoryLocation.findFirst({ where: { id: dto.fromLocationId, propertyId } }),
      this.prisma.inventoryLocation.findFirst({ where: { id: dto.toLocationId, propertyId } }),
    ]);
    if (!from) throw new NotFoundException(`Izvorna lokacija ${dto.fromLocationId} nije pronađena.`);
    if (!to) throw new NotFoundException(`Ciljna lokacija ${dto.toLocationId} nije pronađena.`);

    return this.prisma.$transaction(async (tx) => {
      for (const line of dto.lines) {
        const stock = await tx.stockLevel.findUnique({
          where: { itemId_locationId: { itemId: line.itemId, locationId: dto.fromLocationId } },
        });
        if (!stock || Number(stock.quantityOnHand) < line.quantity) {
          throw new BadRequestException(
            `Nedovoljno zaliha artikla ${line.itemId} na izvornoj lokaciji za transfer.`,
          );
        }
      }

      const transfer = await tx.transfer.create({
        data: {
          propertyId,
          fromLocationId: dto.fromLocationId,
          toLocationId: dto.toLocationId,
          requestedBy: dto.requestedBy,
          lines: { create: dto.lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })) },
        },
        include: { lines: true },
      });

      for (const line of dto.lines) {
        await tx.stockLevel.update({
          where: { itemId_locationId: { itemId: line.itemId, locationId: dto.fromLocationId } },
          data: { quantityOnHand: { decrement: line.quantity } },
        });
        await tx.stockLevel.upsert({
          where: { itemId_locationId: { itemId: line.itemId, locationId: dto.toLocationId } },
          update: { quantityOnHand: { increment: line.quantity } },
          create: { itemId: line.itemId, locationId: dto.toLocationId, quantityOnHand: line.quantity },
        });
      }

      return transfer;
    });
  }

  async findTransfers(propertyId: string) {
    return this.prisma.transfer.findMany({
      where: { propertyId },
      include: {
        fromLocation: { select: { name: true } },
        toLocation: { select: { name: true } },
        lines: { include: { item: { select: { sku: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Depletion / Waste (odvojen tip transakcije od Transfer) ────────────────

  async createDepletion(propertyId: string, dto: CreateDepletionDto) {
    const location = await this.prisma.inventoryLocation.findFirst({
      where: { id: dto.locationId, propertyId },
    });
    if (!location) throw new NotFoundException(`Lokacija ${dto.locationId} nije pronađena.`);

    return this.prisma.$transaction(async (tx) => {
      const stock = await tx.stockLevel.findUnique({
        where: { itemId_locationId: { itemId: dto.itemId, locationId: dto.locationId } },
      });
      if (!stock || Number(stock.quantityOnHand) < dto.quantity) {
        throw new BadRequestException('Nedovoljno zaliha artikla na lokaciji za ovu otpisanu količinu.');
      }

      await tx.stockLevel.update({
        where: { itemId_locationId: { itemId: dto.itemId, locationId: dto.locationId } },
        data: { quantityOnHand: { decrement: dto.quantity } },
      });

      return tx.depletionAdjustment.create({
        data: {
          propertyId,
          locationId: dto.locationId,
          itemId: dto.itemId,
          quantity: dto.quantity,
          reason: dto.reason,
          notes: dto.notes,
        },
      });
    });
  }

  async findDepletions(propertyId: string) {
    return this.prisma.depletionAdjustment.findMany({
      where: { propertyId },
      include: {
        location: { select: { name: true } },
        item: { select: { sku: true, name: true, unit: true } },
      },
      orderBy: { occurredAt: 'desc' },
    });
  }
}
