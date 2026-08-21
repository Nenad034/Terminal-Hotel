import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiQuery } from '@nestjs/swagger';
import { CapacityService } from './capacity.service';
import { PropertyId } from '../../common/decorators/tenant.decorator';

@ApiTags('Capacity')
@ApiSecurity('property-context')
@Controller('capacity')
export class CapacityController {
  constructor(private readonly capacityService: CapacityService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Real-time pregled kapaciteta i zauzetosti svih resursa',
    description:
      'Jedinstven pregled zauzetosti soba (po tipu), restorana, spa soba i kongresnih sala. ' +
      'Sve u jednom pozovu, bez posebnih tabela — live upit nad domenskim tabelama.',
  })
  getCapacityOverview(@PropertyId() propertyId: string) {
    return this.capacityService.getCapacityOverview(propertyId);
  }

  @Get('history')
  @ApiOperation({
    summary: 'Istorijski pregled zauzetosti po danima (iz night audit snapshota)',
    description:
      'Vraća OccupancySnapshotDaily za zadati opseg datuma. ' +
      'Koristiti za trenodve prikaze (nedelja/mesec/godina). ' +
      'Podaci dolaze iz noćnog audita (night_audit source).',
  })
  @ApiQuery({ name: 'from', example: '2026-08-01' })
  @ApiQuery({ name: 'to', example: '2026-08-31' })
  @ApiQuery({ name: 'resourceType', required: false, enum: ['ROOM', 'DINING_TABLE', 'SPA_RESOURCE', 'FUNCTION_SPACE'] })
  getOccupancyHistory(
    @PropertyId() propertyId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('resourceType') resourceType?: string,
  ) {
    return this.capacityService.getOccupancyHistory(
      propertyId,
      new Date(from),
      new Date(to),
      resourceType,
    );
  }
}
