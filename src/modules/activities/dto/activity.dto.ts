import { IsString, IsNotEmpty, IsOptional, IsIn, IsISO8601, IsInt, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export const ACTIVITY_STATUSES = ['requested', 'confirmed', 'waitlisted', 'cancelled', 'completed', 'no_show'];

export class CreateActivityBookingDto {
  @ApiProperty({ example: 'Izlet do Đavolje Varoši' })
  @IsString()
  @IsNotEmpty()
  activityName: string;

  @ApiPropertyOptional({ description: 'Naziv/vendor ID eksternog operatera (uloga activity_provider u nabavci)' })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional({ description: 'Broj potvrde u sistemu partnera — ne normalizovati tuđi model' })
  @IsOptional()
  @IsString()
  externalRef?: string;

  @ApiProperty({ example: '2026-09-05T08:00:00.000Z' })
  @IsISO8601()
  scheduledAt: string;

  @ApiPropertyOptional({ example: 2, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  paxCount?: number;

  @ApiProperty({ example: 3500.0 })
  @IsNumber()
  @Min(0)
  totalPrice: number;

  @ApiPropertyOptional({ example: 'RSD', default: 'RSD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'UUID gosta — podrazumevano nosilac rezervacije (primaryGuest)' })
  @IsOptional()
  @IsUuidLoose()
  guestProfileId?: string;
}

export class UpdateActivityStatusDto {
  @ApiProperty({ enum: ACTIVITY_STATUSES })
  @IsIn(ACTIVITY_STATUSES)
  status: string;
}

export class ChargeActivityToFolioDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUuidLoose()
  postedBy?: string;
}
