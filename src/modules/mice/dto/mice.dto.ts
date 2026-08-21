import { IsString, IsNotEmpty, IsOptional, IsObject, IsIn, IsISO8601, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const FUNCTION_SPACE_BOOKING_STATUSES = ['tentative', 'definite', 'cancelled'];

export class CreateFunctionSpaceDto {
  @ApiProperty({ example: 'Kristalna dvorana' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: { theatre: 200, banquet: 120, classroom: 80 },
    description: 'Kapacitet po tipu postavke (teatar/banket/učionica...)',
  })
  @IsOptional()
  @IsObject()
  capacityBySetup?: Record<string, number>;
}

export class CreateFunctionSpaceBookingDto {
  @ApiPropertyOptional({ description: 'Referenca eventa u spoljnom sistemu (BEO/Cvent/Delphi)' })
  @IsOptional()
  @IsString()
  eventReference?: string;

  @ApiProperty({ example: '2026-09-10T08:00:00.000Z' })
  @IsISO8601()
  startAt: string;

  @ApiProperty({ example: '2026-09-10T17:00:00.000Z' })
  @IsISO8601()
  endAt: string;

  @ApiPropertyOptional({ example: 'theatre' })
  @IsOptional()
  @IsString()
  setupType?: string;

  @ApiPropertyOptional({ example: 60, default: 0, description: 'Minuti pripreme pre eventa (blokira salu unapred)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  bufferBeforeMin?: number;

  @ApiPropertyOptional({ example: 60, default: 0, description: 'Minuti raspremanja posle eventa' })
  @IsOptional()
  @IsInt()
  @Min(0)
  bufferAfterMin?: number;
}

export class UpdateFunctionSpaceBookingStatusDto {
  @ApiProperty({ enum: FUNCTION_SPACE_BOOKING_STATUSES })
  @IsIn(FUNCTION_SPACE_BOOKING_STATUSES)
  status: string;
}
