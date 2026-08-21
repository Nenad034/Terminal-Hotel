import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt, IsIn, IsISO8601, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export const SPA_RESOURCE_STATUSES = ['available', 'occupied', 'blocked'];

export class CreateSpaResourceDto {
  @ApiProperty({ example: 'Masažna soba 1' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  canExceedCapacity?: boolean;

  @ApiPropertyOptional({ example: 'massage' })
  @IsOptional()
  @IsString()
  roomCategory?: string;

  @ApiPropertyOptional({ description: 'ID u eksternom sistemu (npr. Zenoti) — ovaj resurs je lokalni read-only mirror' })
  @IsOptional()
  @IsString()
  externalRef?: string;
}

export class UpdateSpaResourceStatusDto {
  @ApiProperty({ enum: SPA_RESOURCE_STATUSES })
  @IsIn(SPA_RESOURCE_STATUSES)
  status: string;

  @ApiPropertyOptional({ description: 'Referenca termina u eksternom sistemu' })
  @IsOptional()
  @IsString()
  currentAppointmentReference?: string;
}

export class CreateSpaBlockoutDto {
  @ApiProperty({ example: '2026-09-01T08:00:00.000Z' })
  @IsISO8601()
  startAt: string;

  @ApiProperty({ example: '2026-09-01T10:00:00.000Z' })
  @IsISO8601()
  endAt: string;

  @ApiPropertyOptional({ example: 'Redovno održavanje' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class SpaChargeToRoomDto {
  @ApiProperty({ example: '204' })
  @IsString()
  @IsNotEmpty()
  roomNumber: string;

  @ApiProperty({ example: 'Švedska masaža 60min' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 6000.0 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ example: 0.2 })
  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUuidLoose()
  postedBy?: string;
}
