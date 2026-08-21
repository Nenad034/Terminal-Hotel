import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiParam } from '@nestjs/swagger';
import { ReservationsService } from './reservations.service';
import {
  HoldReservationDto,
  ConfirmReservationDto,
  CancelReservationDto,
  CheckInDto,
  CheckOutDto,
  ReservationListQueryDto,
} from './dto/reservation.dto';
import { PropertyId } from '../../common/decorators/tenant.decorator';

@ApiTags('Reservations')
@ApiSecurity('property-context')
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista rezervacija (filteri: status, datum dolaska/odlaska, broj potvrde)',
  })
  listReservations(
    @PropertyId() propertyId: string,
    @Query() query: ReservationListQueryDto,
  ) {
    return this.reservationsService.listReservations(propertyId, query);
  }

  @Post('hold')
  @ApiOperation({
    summary: 'Drži kapacitet (Hold) — Korak 1 rezervacionog toka',
    description:
      'Kreira rezervaciju u statusu `held` sa TTL rokom (podrazumevano 30 minuta). ' +
      'Automatski otvara folio. Koristi se za paketizaciju (hotel + let + transfer) ' +
      'gde orkestrator drži sve komponente pre konačnog plaćanja.',
  })
  holdReservation(
    @PropertyId() propertyId: string,
    @Body() dto: HoldReservationDto,
  ) {
    return this.reservationsService.holdReservation(propertyId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalji rezervacije sa folijom i istorijom statusa' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  findReservation(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.reservationsService.findReservationById(propertyId, id);
  }

  @Get('by-confirmation/:number')
  @ApiOperation({ summary: 'Pronađi rezervaciju po broju potvrde (TH-XXXXXX)' })
  findByConfirmation(
    @PropertyId() propertyId: string,
    @Param('number') number: string,
  ) {
    return this.reservationsService.findByConfirmationNumber(propertyId, number);
  }

  @Post(':id/confirm')
  @ApiOperation({
    summary: 'Potvrdi rezervaciju — Korak 2 (held → confirmed / booked → confirmed)',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  confirmReservation(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: ConfirmReservationDto,
  ) {
    return this.reservationsService.confirmReservation(propertyId, id, dto);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Otkaži rezervaciju' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  cancelReservation(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: CancelReservationDto,
  ) {
    return this.reservationsService.cancelReservation(propertyId, id, dto);
  }

  @Post(':id/check-in')
  @ApiOperation({
    summary: 'Check-in gosta — dodela sobe, promena statusa sobe u occupied',
    description:
      'Ako `roomId` nije zadat, sistem automatski bira prvu slobodnu čistu sobu ' +
      'traženog tipa. Soba postaje `occupied`.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  checkIn(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: CheckInDto,
  ) {
    return this.reservationsService.checkIn(propertyId, id, dto);
  }

  @Post(':id/check-out')
  @ApiOperation({
    summary: 'Check-out gosta — soba postaje vacant+dirty, folio se zatvara',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  checkOut(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: CheckOutDto,
  ) {
    return this.reservationsService.checkOut(propertyId, id, dto);
  }
}
