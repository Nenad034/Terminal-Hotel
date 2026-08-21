import { IsInt, IsOptional, IsString, IsPositive, IsISO8601 } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export class EarnPointsDto {
  @ApiProperty({ example: 1200 })
  @IsInt()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ example: '00000000-0000-0000-0000-000000000501' })
  @IsOptional()
  @IsUuidLoose()
  sourceReservationId?: string;

  @ApiPropertyOptional({ example: '2027-08-21', description: 'Datum isteka bodova (podrazumevano +24 meseca)' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @ApiPropertyOptional({ example: 'Boravak 3 noći, avgust 2026.' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class RedeemPointsDto {
  @ApiProperty({ example: 500 })
  @IsInt()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ example: 'Iskorišćeno za nadogradnju sobe' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class AdjustPointsDto {
  @ApiProperty({ example: -200, description: 'Može biti pozitivan ili negativan (ručna korekcija)' })
  @IsInt()
  amount: number;

  @ApiProperty({ example: 'Korekcija greške u ranijem knjiženju' })
  @IsString()
  description: string;
}

export class CreateLoyaltyTierDto {
  @ApiProperty({ example: 'Gold' })
  @IsString()
  tierName: string;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  qualifyingNights?: number;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @IsInt()
  qualifyingStays?: number;

  @ApiPropertyOptional({ example: 3000 })
  @IsOptional()
  qualifyingSpend?: number;
}
