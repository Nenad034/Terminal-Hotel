import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiSecurity } from '@nestjs/swagger';
import { RoomsService } from './rooms.service';
import {
  CreateRoomTypeDto,
  CreateRoomDto,
  UpdateRoomStatusDto,
  RoomFilterDto,
} from './dto/room.dto';
import { PropertyId } from '../../common/decorators/tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Properties & Rooms')
@ApiSecurity('property-context')
@Controller()
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  // ─── Room Types ─────────────────────────────────────────────────────────────

  @Post('room-types')
  @RequirePermissions('rooms:manage')
  @ApiOperation({ summary: 'Kreiraj tip sobe' })
  createRoomType(@PropertyId() propertyId: string, @Body() dto: CreateRoomTypeDto) {
    return this.roomsService.createRoomType(propertyId, dto);
  }

  @Get('room-types')
  @ApiOperation({ summary: 'Lista svih tipova soba' })
  findRoomTypes(@PropertyId() propertyId: string) {
    return this.roomsService.findRoomTypes(propertyId);
  }

  @Get('room-types/:id')
  @ApiOperation({ summary: 'Detalji tipa sobe sa listom fizičkih soba' })
  findRoomTypeById(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.roomsService.findRoomTypeById(propertyId, id);
  }

  // ─── Rooms ──────────────────────────────────────────────────────────────────

  @Post('rooms')
  @RequirePermissions('rooms:manage')
  @ApiOperation({ summary: 'Dodaj fizičku sobu' })
  createRoom(@PropertyId() propertyId: string, @Body() dto: CreateRoomDto) {
    return this.roomsService.createRoom(propertyId, dto);
  }

  @Get('rooms')
  @ApiOperation({ summary: 'Lista soba sa filterima (status, sprat, tip sobe)' })
  findRooms(@PropertyId() propertyId: string, @Query() filter: RoomFilterDto) {
    return this.roomsService.findRooms(propertyId, filter);
  }

  @Get('rooms/housekeeping')
  @ApiOperation({ summary: 'Housekeeping tabla — sobe grupisane po spratovima' })
  getHousekeepingBoard(@PropertyId() propertyId: string) {
    return this.roomsService.getHousekeepingBoard(propertyId);
  }

  @Get('rooms/:id')
  @ApiOperation({ summary: 'Detalji sobe sa istorijom statusa i otvorenim zadacima' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  findRoomById(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.roomsService.findRoomById(propertyId, id);
  }

  @Patch('rooms/:id/status')
  @RequirePermissions('rooms:manage')
  @ApiOperation({
    summary: 'Ažuriraj status sobe — housekeeping/recepcija',
    description:
      'Menja cleanlinessStatus i/ili occupancyStatus sobe. Svaka promena se automatski beleži u room_status_event audit log.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  updateRoomStatus(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRoomStatusDto,
  ) {
    return this.roomsService.updateRoomStatus(propertyId, id, dto);
  }

  @Get('rooms/:id/status-history')
  @ApiOperation({ summary: 'Istorija promena statusa sobe (poslednjih 50)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  getRoomStatusHistory(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.roomsService.getRoomStatusHistory(propertyId, id);
  }
}
