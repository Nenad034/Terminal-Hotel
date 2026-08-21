import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiParam } from '@nestjs/swagger';
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto, UpdateIncidentDto, IncidentFilterDto, CreateCorrectiveActionDto } from './dto/compliance.dto';
import { PropertyId } from '../../common/decorators/tenant.decorator';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtPayload } from '../auth/auth.service';

@ApiTags('Incidents')
@ApiSecurity('property-context')
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  @RequirePermissions('incidents:manage')
  @ApiOperation({ summary: 'Prijavi nezgodu/bezbednosni incident' })
  createIncident(
    @PropertyId() propertyId: string,
    @CurrentEmployee() employee: JwtPayload,
    @Body() dto: CreateIncidentDto,
  ) {
    return this.incidentsService.createIncident(propertyId, employee.sub, dto);
  }

  @Get()
  @RequirePermissions('incidents:manage')
  @ApiOperation({ summary: 'Lista incidenata (filteri: status, tip, ozbiljnost)' })
  findIncidents(@PropertyId() propertyId: string, @Query() filter: IncidentFilterDto) {
    return this.incidentsService.findIncidents(propertyId, filter);
  }

  @Patch(':id')
  @RequirePermissions('incidents:manage')
  @ApiOperation({ summary: 'Ažuriraj incident (status, uzrok, referenca osiguranja)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  updateIncident(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateIncidentDto,
  ) {
    return this.incidentsService.updateIncident(propertyId, id, dto);
  }

  @Post(':id/corrective-action')
  @RequirePermissions('incidents:manage')
  @ApiOperation({
    summary: 'Evidentiraj korektivnu akciju — zatvara incident (status → resolved)',
    description: 'Koristi isti CorrectiveAction entitet kao HACCP (pogl. 24).',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  attachCorrectiveAction(
    @PropertyId() propertyId: string,
    @CurrentEmployee() employee: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateCorrectiveActionDto,
  ) {
    return this.incidentsService.attachCorrectiveAction(propertyId, employee.sub, id, dto);
  }
}
