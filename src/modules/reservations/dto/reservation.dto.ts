import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsISO8601,
  IsInt,
  IsIn,
  IsUUID,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HoldReservationDto {
  @ApiProperty({ description: 'UUID gosta' })
  @IsUUID()
  primaryGuestId: string;

  @ApiProperty({ description: 'UUID tipa sobe' })
  @IsUUID()
  roomTypeId: string;

  @ApiProperty({ example: '2026-09-01' })
  @IsISO8601()
  checkIn: string;

  @ApiProperty({ example: '2026-09-05' })
  @IsISO8601()
  checkOut: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  adults?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  children?: number;

  @ApiPropertyOptional({ description: 'UUID rate plana' })
  @IsOptional()
  @IsUUID()
  ratePlanId?: string;

  @ApiPropertyOptional({
    enum: ['direct', 'ota', 'gds', 'phone', 'walk_in', 'group', 'package'],
    default: 'direct',
  })
  @IsOptional()
  @IsIn(['direct', 'ota', 'gds', 'phone', 'walk_in', 'group', 'package'])
  source?: string;

  @ApiPropertyOptional({ description: 'ID rezervacije u OTA/GDS sistemu' })
  @IsOptional()
  @IsString()
  channelReference?: string;

  @ApiPropertyOptional({ description: 'Referenca ka eksternom Package zapisu' })
  @IsOptional()
  @IsString()
  externalPackageId?: string;

  @ApiPropertyOptional({
    example: 15,
    default: 30,
    description: 'TTL hold-a u minutama (podrazumevano 30)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  holdDurationMinutes?: number;

  @ApiPropertyOptional({ example: 'Tiha soba, visok sprat' })
  @IsOptional()
  @IsString()
  specialRequests?: string;
}

export class ConfirmReservationDto {
  @ApiPropertyOptional({ description: 'ID zaposlenog koji potvrđuje (recepcija)' })
  @IsOptional()
  @IsUUID()
  actorEmployeeId?: string;
}

export class CancelReservationDto {
  @ApiPropertyOptional({ description: 'Razlog otkazivanja' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  actorEmployeeId?: string;
}

export class CheckInDto {
  @ApiPropertyOptional({ description: 'UUID fizičke sobe koja se dodeljuje gostu' })
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  actorEmployeeId?: string;
}

export class CheckOutDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  actorEmployeeId?: string;
}

export class ReservationListQueryDto {
  @ApiPropertyOptional({
    enum: ['held', 'booked', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show', 'expired'],
  })
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsISO8601()
  arrivalDate?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsISO8601()
  departureDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  confirmationNumber?: string;
}
