import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoomTypeDto {
  @ApiProperty({ example: 'DBL-DLX' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Deluxe Double' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  baseOccupancy: number;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  maxOccupancy: number;

  @ApiProperty({ example: false, description: 'Pristupačna soba (WCAG zahtev)' })
  @IsBoolean()
  accessible: boolean;

  @ApiPropertyOptional({ example: ['WiFi', 'minibar', 'king bed'] })
  @IsOptional()
  amenities?: string[];
}

export class CreateRoomDto {
  @ApiProperty({ example: '101' })
  @IsString()
  @IsNotEmpty()
  roomNumber: string;

  @ApiProperty({ example: '1. sprat', description: 'Sprat sobe' })
  @IsOptional()
  @IsString()
  floor?: string;

  @ApiProperty({ description: 'UUID tipa sobe' })
  @IsUuidLoose()
  roomTypeId: string;
}

export class UpdateRoomStatusDto {
  @ApiPropertyOptional({ enum: ['dirty', 'clean', 'inspected', 'pickup'] })
  @IsOptional()
  @IsIn(['dirty', 'clean', 'inspected', 'pickup'])
  cleanlinessStatus?: string;

  @ApiPropertyOptional({ enum: ['vacant', 'occupied'] })
  @IsOptional()
  @IsIn(['vacant', 'occupied'])
  occupancyStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  outOfOrder?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  outOfService?: boolean;

  @ApiPropertyOptional({ description: 'ID zaposlenog koji menja status' })
  @IsOptional()
  @IsUuidLoose()
  changedBy?: string;
}

export class RoomFilterDto {
  @ApiPropertyOptional({ enum: ['dirty', 'clean', 'inspected', 'pickup'] })
  @IsOptional()
  @IsIn(['dirty', 'clean', 'inspected', 'pickup'])
  cleanlinessStatus?: string;

  @ApiPropertyOptional({ enum: ['vacant', 'occupied'] })
  @IsOptional()
  @IsIn(['vacant', 'occupied'])
  occupancyStatus?: string;

  @ApiPropertyOptional({ description: 'Broj sprata' })
  @IsOptional()
  @IsString()
  floor?: string;

  @ApiPropertyOptional({ description: 'UUID tipa sobe' })
  @IsOptional()
  @IsUuidLoose()
  roomTypeId?: string;
}
