import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiParam } from '@nestjs/swagger';
import { MiceService } from './mice.service';
import {
  CreateFunctionSpaceDto,
  CreateFunctionSpaceBookingDto,
  UpdateFunctionSpaceBookingStatusDto,
} from './dto/mice.dto';
import { PropertyId } from '../../common/decorators/tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('MICE')
@ApiSecurity('property-context')
@Controller()
export class MiceController {
  constructor(private readonly miceService: MiceService) {}

  @Post('function-spaces')
  @RequirePermissions('mice:manage')
  @ApiOperation({ summary: 'Kreiraj kongresnu salu (kapacitet po tipu postavke)' })
  createFunctionSpace(@PropertyId() propertyId: string, @Body() dto: CreateFunctionSpaceDto) {
    return this.miceService.createFunctionSpace(propertyId, dto);
  }

  @Get('function-spaces')
  @ApiOperation({ summary: 'Lista kongresnih sala' })
  findFunctionSpaces(@PropertyId() propertyId: string) {
    return this.miceService.findFunctionSpaces(propertyId);
  }

  @Post('function-spaces/:id/bookings')
  @RequirePermissions('mice:manage')
  @ApiOperation({
    summary: 'Rezerviši salu za event (BEO-lite)',
    description: 'Odbija zahtev pri preklapanju termina, uzimajući u obzir bufferBeforeMin/bufferAfterMin.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  createBooking(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: CreateFunctionSpaceBookingDto,
  ) {
    return this.miceService.createBooking(propertyId, id, dto);
  }

  @Get('function-spaces/:id/bookings')
  @ApiOperation({ summary: 'Lista rezervacija sale' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  findBookings(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.miceService.findBookings(propertyId, id);
  }

  @Patch('function-space-bookings/:id/status')
  @RequirePermissions('mice:manage')
  @ApiOperation({ summary: 'Promeni status rezervacije (tentative→definite/cancelled)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  updateBookingStatus(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFunctionSpaceBookingStatusDto,
  ) {
    return this.miceService.updateBookingStatus(propertyId, id, dto);
  }
}
