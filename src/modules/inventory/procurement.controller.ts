import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiParam } from '@nestjs/swagger';
import { ProcurementService } from './procurement.service';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderStatusDto,
  CreateReceiptDto,
  CreateTransferDto,
  CreateDepletionDto,
} from './dto/inventory.dto';
import { PropertyId } from '../../common/decorators/tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Inventory / Procurement')
@ApiSecurity('property-context')
@Controller()
export class ProcurementController {
  constructor(private readonly procurementService: ProcurementService) {}

  // ─── Purchase Orders ────────────────────────────────────────────────────────

  @Post('purchase-orders')
  @RequirePermissions('inventory:manage')
  @ApiOperation({ summary: 'Kreiraj narudžbenicu (draft)' })
  createPurchaseOrder(@PropertyId() propertyId: string, @Body() dto: CreatePurchaseOrderDto) {
    return this.procurementService.createPurchaseOrder(propertyId, dto);
  }

  @Get('purchase-orders')
  @ApiOperation({ summary: 'Lista narudžbenica' })
  findPurchaseOrders(@PropertyId() propertyId: string) {
    return this.procurementService.findPurchaseOrders(propertyId);
  }

  @Get('purchase-orders/:id')
  @ApiOperation({ summary: 'Detalji narudžbenice sa stavkama i primljenom robom' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  findPurchaseOrderById(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.procurementService.findPurchaseOrderById(propertyId, id);
  }

  @Patch('purchase-orders/:id/status')
  @RequirePermissions('inventory:manage')
  @ApiOperation({ summary: 'Promeni status narudžbenice (draft→submitted / cancelled)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  updatePurchaseOrderStatus(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderStatusDto,
  ) {
    return this.procurementService.updatePurchaseOrderStatus(propertyId, id, dto);
  }

  // ─── Receipts ───────────────────────────────────────────────────────────────

  @Post('receipts')
  @RequirePermissions('inventory:manage')
  @ApiOperation({
    summary: 'Primi robu (3-way match: PO ↔ Receipt)',
    description:
      'Uvećava StockLevel na lokaciji, ažurira InventoryItem.costPerUnit (last-cost) po stavci, ' +
      'i ako je vezana narudžbenica prosleđena, prebacuje je u status received.',
  })
  createReceipt(@PropertyId() propertyId: string, @Body() dto: CreateReceiptDto) {
    return this.procurementService.createReceipt(propertyId, dto);
  }

  // ─── Transfers ──────────────────────────────────────────────────────────────

  @Post('transfers')
  @RequirePermissions('inventory:manage')
  @ApiOperation({ summary: 'Premesti zalihe između dve lokacije (GL cross-charge)' })
  createTransfer(@PropertyId() propertyId: string, @Body() dto: CreateTransferDto) {
    return this.procurementService.createTransfer(propertyId, dto);
  }

  @Get('transfers')
  @ApiOperation({ summary: 'Lista transfera' })
  findTransfers(@PropertyId() propertyId: string) {
    return this.procurementService.findTransfers(propertyId);
  }

  // ─── Depletion / Waste ────────────────────────────────────────────────────

  @Post('depletion-adjustments')
  @RequirePermissions('inventory:manage')
  @ApiOperation({
    summary: 'Evidentiraj otpad/kvar/krađu (odvojen tip transakcije od Transfer)',
    description: 'Ključno za ideal-vs-actual food cost — ne meša se sa premeštanjem između lokacija.',
  })
  createDepletion(@PropertyId() propertyId: string, @Body() dto: CreateDepletionDto) {
    return this.procurementService.createDepletion(propertyId, dto);
  }

  @Get('depletion-adjustments')
  @ApiOperation({ summary: 'Lista otpisanih količina' })
  findDepletions(@PropertyId() propertyId: string) {
    return this.procurementService.findDepletions(propertyId);
  }
}
