import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { PropertiesService } from './properties.service';
import {
  CreateOrganizationDto,
  CreatePropertyDto,
  UpdatePropertyDto,
} from './dto/property.dto';
import { PropertyId } from '../../common/decorators/tenant.decorator';

@ApiTags('Properties & Rooms')
@Controller()
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  // ─── Organizations ─────────────────────────────────────────────────────────

  @Post('organizations')
  @ApiOperation({ summary: 'Kreiraj organizaciju (lanac / vlasnik)' })
  createOrganization(@Body() dto: CreateOrganizationDto) {
    return this.propertiesService.createOrganization(dto);
  }

  @Get('organizations')
  @ApiOperation({ summary: 'Lista svih organizacija' })
  findAllOrganizations() {
    return this.propertiesService.findAllOrganizations();
  }

  @Get('organizations/:id')
  @ApiOperation({ summary: 'Detalji organizacije sa listom objekata' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  findOrganization(@Param('id') id: string) {
    return this.propertiesService.findOrganizationById(id);
  }

  @Post('organizations/:organizationId/properties')
  @ApiOperation({ summary: 'Kreiraj hotel u okviru organizacije' })
  @ApiParam({ name: 'organizationId', type: 'string', format: 'uuid' })
  createProperty(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreatePropertyDto,
  ) {
    return this.propertiesService.createProperty(organizationId, dto);
  }

  @Get('organizations/:organizationId/properties')
  @ApiOperation({ summary: 'Lista svih hotela u organizaciji' })
  findPropertiesByOrg(@Param('organizationId') organizationId: string) {
    return this.propertiesService.findPropertiesByOrganization(organizationId);
  }

  // ─── Property (koristi x-property-id kontekst) ─────────────────────────────

  @Get('properties/me')
  @ApiOperation({ summary: 'Detalji trenutnog objekta (iz x-property-id headera)' })
  findCurrentProperty(@PropertyId() propertyId: string) {
    return this.propertiesService.findPropertyById(propertyId);
  }

  @Patch('properties/me')
  @ApiOperation({ summary: 'Ažuriraj podatke trenutnog objekta' })
  updateProperty(@PropertyId() propertyId: string, @Body() dto: UpdatePropertyDto) {
    return this.propertiesService.updateProperty(propertyId, dto);
  }

  @Get('properties/me/stats')
  @ApiOperation({
    summary: 'Dashboard statistike — popunjenost, dolasci, odlasci danas',
  })
  getPropertyStats(@PropertyId() propertyId: string) {
    return this.propertiesService.getPropertyStats(propertyId);
  }
}
