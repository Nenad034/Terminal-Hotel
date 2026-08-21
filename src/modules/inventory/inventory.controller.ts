import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiParam } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CreateVendorDto, CreateLocationDto, CreateItemDto } from './dto/inventory.dto';
import { PropertyId } from '../../common/decorators/tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Inventory / Procurement')
@ApiSecurity('property-context')
@Controller()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ─── Vendors ────────────────────────────────────────────────────────────────

  @Post('vendors')
  @RequirePermissions('inventory:manage')
  @ApiOperation({ summary: 'Kreiraj dobavljača' })
  createVendor(@PropertyId() propertyId: string, @Body() dto: CreateVendorDto) {
    return this.inventoryService.createVendor(propertyId, dto);
  }

  @Get('vendors')
  @ApiOperation({ summary: 'Lista dobavljača' })
  findVendors(@PropertyId() propertyId: string) {
    return this.inventoryService.findVendors(propertyId);
  }

  // ─── Locations ──────────────────────────────────────────────────────────────

  @Post('inventory-locations')
  @RequirePermissions('inventory:manage')
  @ApiOperation({
    summary: 'Kreiraj magacinsku lokaciju (rekurzivna hijerarhija)',
    description:
      'Centralni magacin → Komisarijat → Objekat → Restoran/bar | Housekeeping | Spa → Soba (minibar). ' +
      'Mali hotel instancira 2 nivoa preko parentLocationId, resort/lanac ceo tree.',
  })
  createLocation(@PropertyId() propertyId: string, @Body() dto: CreateLocationDto) {
    return this.inventoryService.createLocation(propertyId, dto);
  }

  @Get('inventory-locations')
  @ApiOperation({ summary: 'Lista magacinskih lokacija' })
  findLocations(@PropertyId() propertyId: string) {
    return this.inventoryService.findLocations(propertyId);
  }

  @Get('inventory-locations/:id/stock')
  @ApiOperation({ summary: 'Trenutno stanje zaliha na lokaciji' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  findLocationStock(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.inventoryService.findLocationStock(propertyId, id);
  }

  // ─── Items ──────────────────────────────────────────────────────────────────

  @Post('inventory-items')
  @RequirePermissions('inventory:manage')
  @ApiOperation({ summary: 'Kreiraj artikal (prodajni/potrošni)' })
  createItem(@PropertyId() propertyId: string, @Body() dto: CreateItemDto) {
    return this.inventoryService.createItem(propertyId, dto);
  }

  @Get('inventory-items')
  @ApiOperation({ summary: 'Lista artikala' })
  findItems(@PropertyId() propertyId: string) {
    return this.inventoryService.findItems(propertyId);
  }

  @Get('inventory-items/:id')
  @ApiOperation({ summary: 'Detalji artikla sa zalihama po lokaciji' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  findItemById(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.inventoryService.findItemById(propertyId, id);
  }
}
