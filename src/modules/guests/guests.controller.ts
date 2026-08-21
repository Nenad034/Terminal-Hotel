import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiHeader } from '@nestjs/swagger';
import { GuestsService } from './guests.service';
import { CreateGuestDto, UpdateGuestDto, GuestSearchDto } from './dto/guest.dto';
import { PropertyId } from '../../common/decorators/tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Guests')
@ApiSecurity('property-context')
@ApiHeader({ name: 'x-organization-id', description: 'UUID organizacije', required: true })
@Controller('guests')
export class GuestsController {
  constructor(private readonly guestsService: GuestsService) {}

  @Post()
  @RequirePermissions('guests:manage')
  @ApiOperation({
    summary: 'Kreiraj/pronađi gosta (dedup po email-u unutar organizacije)',
    description:
      'Ako gost sa ovim emailom već postoji u organizaciji, vraća postojeći profil ' +
      'sa `_deduplicated: true`. U suprotnom kreira novi profil.',
  })
  createOrFindGuest(
    @Headers('x-organization-id') organizationId: string,
    @Body() dto: CreateGuestDto,
  ) {
    return this.guestsService.createOrFindGuest(organizationId, dto);
  }

  @Get('search')
  @ApiOperation({ summary: 'Pretraga gostiju po prezimenu, emailu, telefonu ili loyalty broju' })
  searchGuests(
    @Headers('x-organization-id') organizationId: string,
    @Query() search: GuestSearchDto,
  ) {
    return this.guestsService.searchGuests(organizationId, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Profil gosta sa istorijom rezervacija i loyalty transakcijama' })
  findGuestById(
    @Headers('x-organization-id') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.guestsService.findGuestById(organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions('guests:manage')
  @ApiOperation({ summary: 'Ažuriraj profil gosta' })
  updateGuest(
    @Headers('x-organization-id') organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateGuestDto,
  ) {
    return this.guestsService.updateGuest(organizationId, id, dto);
  }

  @Delete(':id/gdpr')
  @RequirePermissions('guests:manage')
  @ApiOperation({
    summary: 'GDPR pravo na brisanje — anonimizacija PII podataka',
    description:
      'Anonimizuje lične podatke gosta (ime, email, telefon, dokument). ' +
      'Ne briše zapis fizički — folio istorija ostaje za poreske svrhe. ' +
      'Nije dozvoljeno ako gost ima aktivne rezervacije.',
  })
  gdprDeleteGuest(
    @Headers('x-organization-id') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.guestsService.gdprDeleteGuest(organizationId, id);
  }

  @Get(':id/stay-history')
  @ApiOperation({ summary: 'Kompletna istorija boravaka gosta' })
  getGuestStayHistory(
    @Headers('x-organization-id') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.guestsService.getGuestStayHistory(organizationId, id);
  }
}
