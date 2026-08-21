import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { FinanceQueryDto, ExportJournalDto } from './dto/finance.dto';
import { PropertyId } from '../../common/decorators/tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

@ApiTags('Finance / KPI')
@ApiSecurity('property-context')
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('kpi')
  @RequirePermissions('finance:manage')
  @ApiOperation({
    summary: 'Occupancy% / ADR / RevPAR / TRevPAR za period (USALI/HFTP formule)',
    description: 'Podrazumevani period: tekući mesec do danas. Izvor: OccupancySnapshotDaily + JournalEntry.',
  })
  getKpi(@PropertyId() propertyId: string, @Query() query: FinanceQueryDto) {
    const from = query.from ? new Date(query.from) : startOfMonth();
    const to = query.to ? new Date(query.to) : endOfToday();
    return this.financeService.getKpi(propertyId, from, to);
  }

  @Get('journal')
  @RequirePermissions('finance:manage')
  @ApiOperation({ summary: 'GL journal entries za period (filter: neizvezene/izvezene preko exported)' })
  findJournal(@PropertyId() propertyId: string, @Query() query: FinanceQueryDto) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    return this.financeService.findJournalEntries(propertyId, from, to);
  }

  @Post('journal/export-batch')
  @RequirePermissions('finance:manage')
  @ApiOperation({
    summary: 'Izvezi (označi kao exported) sve neizvezene journal entries za period',
    description:
      'Isti adapter princip kao fiskalizacija/SEF (pogl. 17/21) — PMS ne zove GL sistem uživo, ' +
      'samo priprema batch koji spoljni adapter (QuickBooks/Xero/M3) preuzima.',
  })
  exportBatch(@PropertyId() propertyId: string, @Body() dto: ExportJournalDto) {
    const from = dto.from ? new Date(dto.from) : undefined;
    const to = dto.to ? new Date(dto.to) : undefined;
    return this.financeService.exportJournalBatch(propertyId, from, to);
  }
}
