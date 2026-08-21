import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiParam } from '@nestjs/swagger';
import { LoyaltyService } from './loyalty.service';
import { EarnPointsDto, RedeemPointsDto, AdjustPointsDto, CreateLoyaltyTierDto } from './dto/loyalty.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Loyalty')
@ApiSecurity('property-context')
@Controller()
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Post('guests/:guestId/loyalty/earn')
  @RequirePermissions('loyalty:manage')
  @ApiOperation({ summary: 'Knjiži zarađene bodove (earn)' })
  @ApiParam({ name: 'guestId', type: 'string', format: 'uuid' })
  earn(@Param('guestId') guestId: string, @Body() dto: EarnPointsDto) {
    return this.loyaltyService.earnPoints(guestId, dto);
  }

  @Post('guests/:guestId/loyalty/redeem')
  @RequirePermissions('loyalty:manage')
  @ApiOperation({ summary: 'Iskoristi bodove (redeem) — odbija ako nema dovoljno raspoloživih' })
  @ApiParam({ name: 'guestId', type: 'string', format: 'uuid' })
  redeem(@Param('guestId') guestId: string, @Body() dto: RedeemPointsDto) {
    return this.loyaltyService.redeemPoints(guestId, dto);
  }

  @Post('guests/:guestId/loyalty/adjust')
  @RequirePermissions('loyalty:manage')
  @ApiOperation({ summary: 'Ručna korekcija bodova (pozitivna ili negativna)' })
  @ApiParam({ name: 'guestId', type: 'string', format: 'uuid' })
  adjust(@Param('guestId') guestId: string, @Body() dto: AdjustPointsDto) {
    return this.loyaltyService.adjustPoints(guestId, dto);
  }

  @Get('guests/:guestId/loyalty/balance')
  @RequirePermissions('loyalty:manage')
  @ApiOperation({ summary: 'Raspoloživo stanje bodova (isključuje istekle earn transakcije)' })
  @ApiParam({ name: 'guestId', type: 'string', format: 'uuid' })
  balance(@Param('guestId') guestId: string) {
    return this.loyaltyService.getBalance(guestId);
  }

  @Get('guests/:guestId/loyalty/history')
  @RequirePermissions('loyalty:manage')
  @ApiOperation({ summary: 'Append-only istorija svih transakcija' })
  @ApiParam({ name: 'guestId', type: 'string', format: 'uuid' })
  history(@Param('guestId') guestId: string) {
    return this.loyaltyService.getHistory(guestId);
  }

  @Post('guests/:guestId/loyalty/recalculate-tier')
  @RequirePermissions('loyalty:manage')
  @ApiOperation({ summary: 'Preračunaj nivo gosta na osnovu poslednja 12 meseca (OR logika: noćenja ILI boravci ILI potrošnja)' })
  @ApiParam({ name: 'guestId', type: 'string', format: 'uuid' })
  recalculateTier(@Param('guestId') guestId: string) {
    return this.loyaltyService.recalculateTier(guestId);
  }

  @Post('loyalty/tiers')
  @RequirePermissions('loyalty:manage')
  @ApiOperation({ summary: 'Definiši novi loyalty nivo' })
  createTier(@Body() dto: CreateLoyaltyTierDto) {
    return this.loyaltyService.createTier(dto);
  }

  @Get('loyalty/tiers')
  @RequirePermissions('loyalty:manage')
  @ApiOperation({ summary: 'Lista definisanih nivoa' })
  findTiers() {
    return this.loyaltyService.findTiers();
  }
}
