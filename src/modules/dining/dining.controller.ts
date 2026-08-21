import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiParam } from '@nestjs/swagger';
import { DiningService } from './dining.service';
import {
  CreateOutletDto,
  CreateTableDto,
  UpdateTableStatusDto,
  CreateDiningReservationDto,
  UpdateDiningReservationDto,
  PostToRoomDto,
} from './dto/dining.dto';
import { PropertyId } from '../../common/decorators/tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('F&B / Dining')
@ApiSecurity('property-context')
@Controller()
export class DiningController {
  constructor(private readonly diningService: DiningService) {}

  // ─── Outlets ────────────────────────────────────────────────────────────────

  @Post('dining/outlets')
  @RequirePermissions('dining:manage')
  @ApiOperation({ summary: 'Kreiraj ugostiteljski objekat (restoran/bar)' })
  createOutlet(@PropertyId() propertyId: string, @Body() dto: CreateOutletDto) {
    return this.diningService.createOutlet(propertyId, dto);
  }

  @Get('dining/outlets')
  @ApiOperation({ summary: 'Lista ugostiteljskih objekata' })
  findOutlets(@PropertyId() propertyId: string) {
    return this.diningService.findOutlets(propertyId);
  }

  @Get('dining/outlets/:id')
  @ApiOperation({ summary: 'Detalji objekta sa listom stolova' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  findOutletById(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.diningService.findOutletById(propertyId, id);
  }

  // ─── Tables ─────────────────────────────────────────────────────────────────

  @Post('dining/outlets/:outletId/tables')
  @RequirePermissions('dining:manage')
  @ApiOperation({ summary: 'Dodaj sto u objekat' })
  @ApiParam({ name: 'outletId', type: 'string', format: 'uuid' })
  createTable(
    @PropertyId() propertyId: string,
    @Param('outletId') outletId: string,
    @Body() dto: CreateTableDto,
  ) {
    return this.diningService.createTable(propertyId, outletId, dto);
  }

  @Get('dining/outlets/:outletId/tables')
  @ApiOperation({ summary: 'Lista stolova u objektu' })
  @ApiParam({ name: 'outletId', type: 'string', format: 'uuid' })
  findTables(@PropertyId() propertyId: string, @Param('outletId') outletId: string) {
    return this.diningService.findTables(propertyId, outletId);
  }

  @Patch('dining/tables/:id/status')
  @RequirePermissions('dining:manage')
  @ApiOperation({ summary: 'Ažuriraj status stola (available/occupied/reserved/blocked)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  updateTableStatus(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTableStatusDto,
  ) {
    return this.diningService.updateTableStatus(propertyId, id, dto);
  }

  // ─── Reservations ───────────────────────────────────────────────────────────

  @Post('dining/outlets/:outletId/reservations')
  @RequirePermissions('dining:manage')
  @ApiOperation({ summary: 'Rezerviši sto (ili walk-in bez dodele stola)' })
  @ApiParam({ name: 'outletId', type: 'string', format: 'uuid' })
  createReservation(
    @PropertyId() propertyId: string,
    @Param('outletId') outletId: string,
    @Body() dto: CreateDiningReservationDto,
  ) {
    return this.diningService.createReservation(propertyId, outletId, dto);
  }

  @Get('dining/outlets/:outletId/reservations')
  @ApiOperation({ summary: 'Lista rezervacija stolova za objekat' })
  @ApiParam({ name: 'outletId', type: 'string', format: 'uuid' })
  findReservations(@PropertyId() propertyId: string, @Param('outletId') outletId: string) {
    return this.diningService.findReservations(propertyId, outletId);
  }

  @Patch('dining/reservations/:id/status')
  @RequirePermissions('dining:manage')
  @ApiOperation({
    summary: 'Promeni status rezervacije stola (seated/completed/cancelled/no_show)',
    description: 'Sto se automatski oslobađa (available) kad rezervacija završi svoj životni ciklus.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  updateReservationStatus(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDiningReservationDto,
  ) {
    return this.diningService.updateReservationStatus(propertyId, id, dto);
  }

  // ─── POS ────────────────────────────────────────────────────────────────────

  @Post('dining/post-to-room')
  @RequirePermissions('dining:manage')
  @ApiOperation({
    summary: 'Knjiži F&B račun na sobu gosta (Toast Tender „post to room" obrazac)',
    description:
      'Pronalazi aktivnu (checked_in) rezervaciju za dati broj sobe i knjiži stavku ' +
      'na njen otvoren folio — isti mehanizam koji koristi i noćni audit za noćenja.',
  })
  postToRoom(@PropertyId() propertyId: string, @Body() dto: PostToRoomDto) {
    return this.diningService.postToRoom(propertyId, dto);
  }
}
