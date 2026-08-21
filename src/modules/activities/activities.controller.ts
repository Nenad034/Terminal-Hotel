import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiParam } from '@nestjs/swagger';
import { ActivitiesService } from './activities.service';
import { CreateActivityBookingDto, UpdateActivityStatusDto, ChargeActivityToFolioDto } from './dto/activity.dto';
import { PropertyId } from '../../common/decorators/tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Activities')
@ApiSecurity('property-context')
@Controller()
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Post('reservations/:reservationId/activities')
  @RequirePermissions('activities:manage')
  @ApiOperation({
    summary: 'Rezerviši aktivnost (izlet/tura/eksterni event) vezanu za boravak',
    description: 'Treći tip rezervacije pored sobe i spa/F&B termina (pogl. 11) — fulfillment često radi eksterni partner.',
  })
  @ApiParam({ name: 'reservationId', type: 'string', format: 'uuid' })
  createBooking(
    @PropertyId() propertyId: string,
    @Param('reservationId') reservationId: string,
    @Body() dto: CreateActivityBookingDto,
  ) {
    return this.activitiesService.createBooking(propertyId, reservationId, dto);
  }

  @Get('reservations/:reservationId/activities')
  @ApiOperation({ summary: 'Aktivnosti vezane za rezervaciju' })
  @ApiParam({ name: 'reservationId', type: 'string', format: 'uuid' })
  findForReservation(@PropertyId() propertyId: string, @Param('reservationId') reservationId: string) {
    return this.activitiesService.findForReservation(propertyId, reservationId);
  }

  @Get('guests/:guestProfileId/activities')
  @ApiOperation({ summary: 'Agregovan itinerar aktivnosti gosta preko svih boravaka' })
  @ApiParam({ name: 'guestProfileId', type: 'string', format: 'uuid' })
  findForGuest(@PropertyId() propertyId: string, @Param('guestProfileId') guestProfileId: string) {
    return this.activitiesService.findForGuest(propertyId, guestProfileId);
  }

  @Patch('activities/:id/status')
  @RequirePermissions('activities:manage')
  @ApiOperation({ summary: 'Promeni status aktivnosti (confirmed/waitlisted/cancelled/completed/no_show)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  updateStatus(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateActivityStatusDto,
  ) {
    return this.activitiesService.updateStatus(propertyId, id, dto);
  }

  @Post('activities/:id/charge-to-folio')
  @RequirePermissions('activities:manage')
  @ApiOperation({
    summary: 'Knjiži aktivnost na folio rezervacije',
    description: 'Jedan od tri režima naplate (pogl. 11) — koristi se za in-stay marketplace/concierge naplatu na sobu.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  chargeToFolio(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: ChargeActivityToFolioDto,
  ) {
    return this.activitiesService.chargeToFolio(propertyId, id, dto);
  }
}
