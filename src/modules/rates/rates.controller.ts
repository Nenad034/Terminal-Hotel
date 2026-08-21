import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { RatesService } from './rates.service';
import {
  CreateRatePlanDto,
  BulkUpdateRatesDto,
  RateCalendarQueryDto,
  AvailabilityQueryDto,
} from './dto/rate.dto';
import { PropertyId } from '../../common/decorators/tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Rates')
@ApiSecurity('property-context')
@Controller()
export class RatesController {
  constructor(private readonly ratesService: RatesService) {}

  @Post('rate-plans')
  @RequirePermissions('rates:manage')
  @ApiOperation({ summary: 'Kreiraj rate plan (cenovnik)' })
  createRatePlan(@PropertyId() propertyId: string, @Body() dto: CreateRatePlanDto) {
    return this.ratesService.createRatePlan(propertyId, dto);
  }

  @Get('rate-plans')
  @ApiOperation({ summary: 'Lista svih rate planova' })
  findRatePlans(@PropertyId() propertyId: string) {
    return this.ratesService.findRatePlans(propertyId);
  }

  @Get('rate-plans/:id')
  @ApiOperation({ summary: 'Detalji rate plana' })
  findRatePlanById(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.ratesService.findRatePlanById(propertyId, id);
  }

  @Post('rates/bulk-update')
  @RequirePermissions('rates:manage')
  @ApiOperation({
    summary: 'Masovno ažuriranje cena (rate calendar)',
    description:
      'Upsert više cena odjednom za određeni rate plan i opseg datuma. ' +
      'Podržava override min LOS i closed-to-arrival po danu.',
  })
  bulkUpdateRates(@PropertyId() propertyId: string, @Body() dto: BulkUpdateRatesDto) {
    return this.ratesService.bulkUpdateRates(propertyId, dto);
  }

  @Get('rates/calendar')
  @ApiOperation({
    summary: 'Kalendar cena — pregled po datumu, tipu sobe i rate planu',
  })
  getRateCalendar(@PropertyId() propertyId: string, @Query() query: RateCalendarQueryDto) {
    return this.ratesService.getRateCalendar(propertyId, query);
  }

  @Get('availability')
  @ApiOperation({
    summary: 'Provera raspoloživosti — dostupni tipovi soba sa cenama za traženi period',
    description:
      'Uzima u obzir rezervacije (uključujući held), OutOfOrder/OutOfService sobe, ' +
      'i Group Block allotmente.',
  })
  checkAvailability(
    @PropertyId() propertyId: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.ratesService.checkAvailability(propertyId, query);
  }
}
