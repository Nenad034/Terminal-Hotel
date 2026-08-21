import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit.dto';
import { PropertyId } from '../../common/decorators/tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Audit Log')
@ApiSecurity('property-context')
@Controller('audit-events')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions('audit:read')
  @ApiOperation({
    summary: 'Pretraga audit loga (SOC 2) — ko je šta menjao kad',
    description: 'Filteri: period, izvršilac, tip resursa (naziv kontrolera), deo naziva akcije.',
  })
  findEvents(@PropertyId() propertyId: string, @Query() query: AuditQueryDto) {
    return this.auditService.findEventsForProperty(propertyId, {
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      actorEmployeeId: query.actorEmployeeId,
      resourceType: query.resourceType,
      action: query.action,
    });
  }

  @Get('verify')
  @RequirePermissions('audit:read')
  @ApiOperation({
    summary: 'Proveri integritet hash-lanca (tamper-evidence)',
    description: 'Ponovo izračunava hash svakog zapisa hronološki i poredi sa upisanom vrednošću.',
  })
  verifyChain(@PropertyId() propertyId: string) {
    return this.auditService.verifyChainForProperty(propertyId);
  }
}
