import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiParam } from '@nestjs/swagger';
import { EsgService } from './esg.service';
import { CreateEsgMetricDto, CreateCertificationDto, UpdateCertificationDto, EsgQueryDto } from './dto/esg.dto';
import { PropertyId } from '../../common/decorators/tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('ESG / Održivost')
@ApiSecurity('property-context')
@Controller('esg')
export class EsgController {
  constructor(private readonly esgService: EsgService) {}

  @Post('metrics')
  @RequirePermissions('esg:manage')
  @ApiOperation({
    summary: 'Ručni unos ESG metrike (karbon, energija, voda, otpad)',
    description: 'source podrazumevano "manual" — automatski unos iz energy-IoT senzora (M14) nije integrisan.',
  })
  createMetric(@PropertyId() propertyId: string, @Body() dto: CreateEsgMetricDto) {
    return this.esgService.createMetric(propertyId, dto);
  }

  @Get('metrics')
  @RequirePermissions('esg:manage')
  @ApiOperation({ summary: 'Lista ESG metrika objekta' })
  findMetrics(@PropertyId() propertyId: string, @Query() query: EsgQueryDto) {
    return this.esgService.findMetrics(propertyId, query.from, query.to);
  }

  @Get('hcmi')
  @RequirePermissions('esg:manage')
  @ApiOperation({
    summary: 'HCMI — karbon po zauzetoj sobi/noći (Hotel Carbon Measurement Initiative)',
    description: 'Deli sumu scope 1+2+3 karbon metrika periodom sa brojem zauzetih soba/noći iz occupancy_snapshot_daily.',
  })
  getHcmi(@PropertyId() propertyId: string, @Query() query: EsgQueryDto) {
    const from = query.from ?? new Date(new Date().getFullYear(), 0, 1).toISOString();
    const to = query.to ?? new Date().toISOString();
    return this.esgService.getHcmi(propertyId, from, to);
  }

  @Post('certifications')
  @RequirePermissions('esg:manage')
  @ApiOperation({ summary: 'Registruj sertifikat (npr. EarthCheck, Green Key)' })
  createCertification(@PropertyId() propertyId: string, @Body() dto: CreateCertificationDto) {
    return this.esgService.createCertification(propertyId, dto);
  }

  @Get('certifications')
  @RequirePermissions('esg:manage')
  @ApiOperation({ summary: 'Lista sertifikata objekta' })
  findCertifications(@PropertyId() propertyId: string) {
    return this.esgService.findCertifications(propertyId);
  }

  @Patch('certifications/:id')
  @RequirePermissions('esg:manage')
  @ApiOperation({ summary: 'Ažuriraj status/datume sertifikata' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  updateCertification(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCertificationDto,
  ) {
    return this.esgService.updateCertification(propertyId, id, dto);
  }
}
