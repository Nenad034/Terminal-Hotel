import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsUUID,
  IsISO8601,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRatePlanDto {
  @ApiProperty({ example: 'BAR' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Best Available Rate' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ example: { free_until_hours: 48, penalty_percent: 100 } })
  @IsOptional()
  cancellationPolicy?: Record<string, any>;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  minLos?: number;

  @ApiPropertyOptional({ example: 14 })
  @IsOptional()
  @IsInt()
  maxLos?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  closedToArrival?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  closedToDeparture?: boolean;

  @ApiPropertyOptional({ default: false, description: 'Last Room Availability garancija' })
  @IsOptional()
  @IsBoolean()
  lastRoomAvailability?: boolean;

  @ApiPropertyOptional({ example: 'RSD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'UUID rate grupe' })
  @IsOptional()
  @IsUUID()
  rateGroupId?: string;

  @ApiPropertyOptional({ description: 'UUID korporativnog naloga' })
  @IsOptional()
  @IsUUID()
  corporateAccountId?: string;
}

export class RateEntryDto {
  @ApiProperty({ description: 'UUID tipa sobe' })
  @IsUUID()
  roomTypeId: string;

  @ApiProperty({ example: '2026-09-01', description: 'Datum boravka (YYYY-MM-DD)' })
  @IsISO8601()
  stayDate: string;

  @ApiProperty({ example: 12000.00 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 2, description: 'Override min LOS za ovaj datum' })
  @IsOptional()
  @IsInt()
  @Min(1)
  minLosOverride?: number;

  @ApiPropertyOptional({ description: 'Override closed-to-arrival za ovaj datum' })
  @IsOptional()
  @IsBoolean()
  closedToArrivalOverride?: boolean;
}

export class BulkUpdateRatesDto {
  @ApiProperty({ description: 'UUID rate plana' })
  @IsUUID()
  ratePlanId: string;

  @ApiProperty({ type: [RateEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RateEntryDto)
  rates: RateEntryDto[];
}

export class RateCalendarQueryDto {
  @ApiProperty({ example: '2026-09-01' })
  @IsISO8601()
  from: string;

  @ApiProperty({ example: '2026-09-30' })
  @IsISO8601()
  to: string;

  @ApiPropertyOptional({ description: 'Filtriranje po UUID tipa sobe' })
  @IsOptional()
  @IsUUID()
  roomTypeId?: string;

  @ApiPropertyOptional({ description: 'Filtriranje po UUID rate plana' })
  @IsOptional()
  @IsUUID()
  ratePlanId?: string;
}

export class AvailabilityQueryDto {
  @ApiProperty({ example: '2026-09-01', description: 'Datum dolaska (check-in)' })
  @IsISO8601()
  checkIn: string;

  @ApiProperty({ example: '2026-09-05', description: 'Datum odlaska (check-out)' })
  @IsISO8601()
  checkOut: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  adults?: number;
}
