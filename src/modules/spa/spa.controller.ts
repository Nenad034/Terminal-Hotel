import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiParam } from '@nestjs/swagger';
import { SpaService } from './spa.service';
import {
  CreateSpaResourceDto,
  UpdateSpaResourceStatusDto,
  CreateSpaBlockoutDto,
  SpaChargeToRoomDto,
} from './dto/spa.dto';
import { PropertyId } from '../../common/decorators/tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Spa / Wellness')
@ApiSecurity('property-context')
@Controller('spa')
export class SpaController {
  constructor(private readonly spaService: SpaService) {}

  @Post('resources')
  @RequirePermissions('spa:manage')
  @ApiOperation({
    summary: 'Registruj spa resurs (masažna soba, sauna, itd.)',
    description: 'Lokalni read-only mirror sistema zapisa (npr. Zenoti) — dashboard prikaz, ne rezervacioni engine.',
  })
  createResource(@PropertyId() propertyId: string, @Body() dto: CreateSpaResourceDto) {
    return this.spaService.createResource(propertyId, dto);
  }

  @Get('resources')
  @ApiOperation({ summary: 'Lista spa resursa sa trenutnim statusom' })
  findResources(@PropertyId() propertyId: string) {
    return this.spaService.findResources(propertyId);
  }

  @Patch('resources/:id/status')
  @RequirePermissions('spa:manage')
  @ApiOperation({ summary: 'Ažuriraj status resursa (available/occupied/blocked)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  updateResourceStatus(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSpaResourceStatusDto,
  ) {
    return this.spaService.updateResourceStatus(propertyId, id, dto);
  }

  @Post('resources/:id/blockouts')
  @RequirePermissions('spa:manage')
  @ApiOperation({ summary: 'Blokiraj resurs za period (održavanje, privatan event)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  createBlockout(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: CreateSpaBlockoutDto,
  ) {
    return this.spaService.createBlockout(propertyId, id, dto);
  }

  @Get('resources/:id/blockouts')
  @ApiOperation({ summary: 'Lista blokada resursa' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  findBlockouts(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.spaService.findBlockouts(propertyId, id);
  }

  @Post('charge-to-room')
  @RequirePermissions('spa:manage')
  @ApiOperation({ summary: 'Knjiži spa tretman na sobu gosta (isti obrazac kao F&B post-to-room)' })
  chargeToRoom(@PropertyId() propertyId: string, @Body() dto: SpaChargeToRoomDto) {
    return this.spaService.chargeToRoom(propertyId, dto);
  }
}
