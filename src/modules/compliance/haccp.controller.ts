import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiParam } from '@nestjs/swagger';
import { HaccpService } from './haccp.service';
import { CreateHaccpLogDto, HaccpLogFilterDto, CreateCorrectiveActionDto } from './dto/compliance.dto';
import { PropertyId } from '../../common/decorators/tenant.decorator';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtPayload } from '../auth/auth.service';

@ApiTags('HACCP')
@ApiSecurity('property-context')
@Controller('haccp/logs')
export class HaccpController {
  constructor(private readonly haccpService: HaccpService) {}

  @Post()
  @RequirePermissions('haccp:manage')
  @ApiOperation({
    summary: 'Upiši CCP merenje (temperatura frižidera/zamrzivača/kuvanja)',
    description: 'passFail se uvek izvodi iz thresholdMin/thresholdMax — nikad ručni unos (pogl. 23).',
  })
  createLog(
    @PropertyId() propertyId: string,
    @CurrentEmployee() employee: JwtPayload,
    @Body() dto: CreateHaccpLogDto,
  ) {
    return this.haccpService.createLog(propertyId, employee.sub, dto);
  }

  @Get()
  @RequirePermissions('haccp:manage')
  @ApiOperation({ summary: 'Lista CCP merenja (filteri: tip, prošao/nije, period)' })
  findLogs(@PropertyId() propertyId: string, @Query() filter: HaccpLogFilterDto) {
    return this.haccpService.findLogs(propertyId, filter);
  }

  @Get('unresolved-failures')
  @RequirePermissions('haccp:manage')
  @ApiOperation({ summary: 'Compliance alarm — neuspela merenja bez korektivne akcije' })
  findUnresolvedFailures(@PropertyId() propertyId: string) {
    return this.haccpService.findUnresolvedFailures(propertyId);
  }

  @Post(':id/corrective-action')
  @RequirePermissions('haccp:manage')
  @ApiOperation({ summary: 'Evidentiraj korektivnu akciju za neuspelo merenje' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  attachCorrectiveAction(
    @PropertyId() propertyId: string,
    @CurrentEmployee() employee: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateCorrectiveActionDto,
  ) {
    return this.haccpService.attachCorrectiveAction(propertyId, employee.sub, id, dto);
  }
}
