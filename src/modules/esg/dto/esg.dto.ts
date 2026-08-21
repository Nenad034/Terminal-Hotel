import { IsString, IsNotEmpty, IsOptional, IsISO8601, IsNumber, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const ESG_METRIC_TYPES = [
  'carbon_scope1',
  'carbon_scope2',
  'carbon_scope3',
  'energy_kwh',
  'water_m3',
  'waste_kg',
] as const;

export class CreateEsgMetricDto {
  @ApiProperty({ enum: ESG_METRIC_TYPES, example: 'carbon_scope2' })
  @IsIn(ESG_METRIC_TYPES)
  metricType: string;

  @ApiProperty({ example: '2026-01-01' })
  @IsISO8601()
  periodStart: string;

  @ApiProperty({ example: '2026-01-31' })
  @IsISO8601()
  periodEnd: string;

  @ApiProperty({ example: 12500.5 })
  @IsNumber()
  value: number;

  @ApiProperty({ example: 'kgCO2e' })
  @IsString()
  @IsNotEmpty()
  unit: string;

  @ApiPropertyOptional({ example: 'manual', description: 'manual dok M14 (energy-IoT) nije integrisan' })
  @IsOptional()
  @IsString()
  source?: string;
}

export class CreateCertificationDto {
  @ApiProperty({ example: 'EarthCheck Gold' })
  @IsString()
  @IsNotEmpty()
  program: string;

  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsOptional()
  @IsISO8601()
  auditDate?: string;

  @ApiPropertyOptional({ example: '2027-03-01' })
  @IsOptional()
  @IsISO8601()
  expiryDate?: string;
}

export class UpdateCertificationDto {
  @ApiPropertyOptional({ example: 'expired' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  auditDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  expiryDate?: string;
}

export class EsgQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
