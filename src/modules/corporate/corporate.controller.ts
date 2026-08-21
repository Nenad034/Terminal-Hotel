import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiParam } from '@nestjs/swagger';
import { CorporateService } from './corporate.service';
import { CreateCorporateAccountDto, UpdateCorporateAccountDto } from './dto/corporate.dto';
import { PropertyId } from '../../common/decorators/tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Corporate Accounts')
@ApiSecurity('property-context')
@Controller('corporate-accounts')
export class CorporateController {
  constructor(private readonly corporateService: CorporateService) {}

  @Post()
  @RequirePermissions('corporate:manage')
  @ApiOperation({
    summary: 'Kreiraj korporativni nalog (ugovorena cena)',
    description: 'Vezuje se za organizaciju (može pokrivati više objekata lanca). Bez accessCode generiše se automatski.',
  })
  createAccount(@PropertyId() propertyId: string, @Body() dto: CreateCorporateAccountDto) {
    return this.corporateService.createAccount(propertyId, dto);
  }

  @Get()
  @RequirePermissions('corporate:manage')
  @ApiOperation({ summary: 'Lista korporativnih naloga organizacije' })
  findAccounts(@PropertyId() propertyId: string) {
    return this.corporateService.findAccounts(propertyId);
  }

  @Get(':id')
  @RequirePermissions('corporate:manage')
  @ApiOperation({ summary: 'Detalji naloga sa povezanim rate planovima' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  findAccountById(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.corporateService.findAccountById(propertyId, id);
  }

  @Patch(':id')
  @RequirePermissions('corporate:manage')
  @ApiOperation({ summary: 'Ažuriraj ugovor (naziv, period)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  updateAccount(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCorporateAccountDto,
  ) {
    return this.corporateService.updateAccount(propertyId, id, dto);
  }
}
