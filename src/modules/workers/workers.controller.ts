import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { WorkersService } from './workers.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Workers')
@Controller('workers')
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Post('ttl-sweep')
  @RequirePermissions('workers:manage')
  @ApiOperation({
    summary: 'Ručno pokreni TTL sweep (za testiranje)',
    description:
      'U produkciji se pokreće automatski svakih 60 sekundi. ' +
      'Ova ruta omogućuje ručno pokretanje za testove i debugging.',
  })
  runTtlSweep() {
    return this.workersService.runTtlSweepManual();
  }

  @Post('night-audit')
  @RequirePermissions('workers:manage')
  @ApiOperation({
    summary: 'Ručno pokreni noćni audit (za testiranje)',
    description:
      'Podrazumevano procesira juče kao poslovni datum. ' +
      'Opciono pošalji `businessDate` u formatu YYYY-MM-DD.',
  })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        businessDate: { type: 'string', example: '2026-08-13', description: 'Poslovni datum (YYYY-MM-DD)' },
      },
    },
  })
  runNightAudit(@Body() body?: { businessDate?: string }) {
    return this.workersService.runNightAuditManual(body?.businessDate);
  }
}
