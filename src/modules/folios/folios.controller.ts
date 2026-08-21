import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiParam } from '@nestjs/swagger';
import { FoliosService } from './folios.service';
import { AddChargeDto, AddPaymentDto, VoidChargeDto } from './dto/folio.dto';
import { PropertyId } from '../../common/decorators/tenant.decorator';

@ApiTags('Folios')
@ApiSecurity('property-context')
@Controller()
export class FoliosController {
  constructor(private readonly foliosService: FoliosService) {}

  @Get('reservations/:reservationId/folio')
  @ApiOperation({ summary: 'Folio rezervacije sa saldom, stavkama i uplatama' })
  @ApiParam({ name: 'reservationId', type: 'string', format: 'uuid' })
  getFolioByReservation(
    @PropertyId() propertyId: string,
    @Param('reservationId') reservationId: string,
  ) {
    return this.foliosService.getFolioByReservation(propertyId, reservationId);
  }

  @Post('folios/:folioId/charges')
  @ApiOperation({
    summary: 'Dodaj stavku na folio (noćenje, minibar, room service, itd.)',
  })
  @ApiParam({ name: 'folioId', type: 'string', format: 'uuid' })
  addCharge(
    @PropertyId() propertyId: string,
    @Param('folioId') folioId: string,
    @Body() dto: AddChargeDto,
  ) {
    return this.foliosService.addCharge(propertyId, folioId, dto);
  }

  @Delete('folios/:folioId/charges/:lineItemId')
  @ApiOperation({ summary: 'Storniraj stavku (void) — ne briše zapis, samo označava kao stornan' })
  @ApiParam({ name: 'folioId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'lineItemId', type: 'string', format: 'uuid' })
  voidCharge(
    @PropertyId() propertyId: string,
    @Param('folioId') folioId: string,
    @Param('lineItemId') lineItemId: string,
    @Body() dto: VoidChargeDto,
  ) {
    return this.foliosService.voidCharge(propertyId, folioId, lineItemId, dto);
  }

  @Post('folios/:folioId/payments')
  @ApiOperation({ summary: 'Evidentiraj uplatu — gotovina, kartica, paket operater' })
  @ApiParam({ name: 'folioId', type: 'string', format: 'uuid' })
  addPayment(
    @PropertyId() propertyId: string,
    @Param('folioId') folioId: string,
    @Body() dto: AddPaymentDto,
  ) {
    return this.foliosService.addPayment(propertyId, folioId, dto);
  }
}
