import { IsString, IsNotEmpty, IsOptional, IsIn, IsNumber, IsBoolean, IsISO8601, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

// ─── HACCP ──────────────────────────────────────────────────────────────────

export const CCP_TYPES = ['fridge_temp', 'freezer_temp', 'cooking_temp', 'other'];

export class CreateHaccpLogDto {
  @ApiProperty({ enum: CCP_TYPES })
  @IsIn(CCP_TYPES)
  ccpType: string;

  @ApiPropertyOptional({ example: 'Kuhinja — frižider 2' })
  @IsOptional()
  @IsString()
  locationReference?: string;

  @ApiProperty({ example: 3.5 })
  @IsNumber()
  readingValue: number;

  @ApiPropertyOptional({ example: 'C', default: 'C' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: 0, description: 'Donji kritični limit (npr. frižider nema, kuvanje da)' })
  @IsOptional()
  @IsNumber()
  thresholdMin?: number;

  @ApiPropertyOptional({ example: 5, description: 'Gornji kritični limit (npr. frižider ≤5°C)' })
  @IsOptional()
  @IsNumber()
  thresholdMax?: number;

  @ApiPropertyOptional({ description: 'UUID zaposlenog koji je izmerio — podrazumevano ulogovani' })
  @IsOptional()
  @IsUuidLoose()
  staffEmployeeId?: string;
}

export class HaccpLogFilterDto {
  @ApiPropertyOptional({ enum: CCP_TYPES })
  @IsOptional()
  @IsIn(CCP_TYPES)
  ccpType?: string;

  @ApiPropertyOptional({ description: "'true' = samo neuspešna merenja" })
  @IsOptional()
  @IsBoolean()
  passFail?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  to?: string;
}

// ─── Corrective Action (deljeno HACCP/Incidenti) ────────────────────────────

export class CreateCorrectiveActionDto {
  @ApiProperty({ example: 'Frižider isključen, roba prebačena, pozvan serviser.' })
  @IsString()
  @IsNotEmpty()
  actionTaken: string;

  @ApiPropertyOptional({ description: 'UUID zaposlenog koji je rešio — podrazumevano ulogovani' })
  @IsOptional()
  @IsUuidLoose()
  resolvedByEmployeeId?: string;
}

// ─── Incidents ──────────────────────────────────────────────────────────────

export const INCIDENT_TYPES = ['guest_injury', 'workplace_accident', 'security', 'property_damage', 'other'];
export const INCIDENT_SEVERITIES = ['low', 'medium', 'high', 'critical'];
export const INCIDENT_STATUSES = ['open', 'investigating', 'resolved', 'closed'];

export class CreateIncidentDto {
  @ApiProperty({ enum: INCIDENT_TYPES })
  @IsIn(INCIDENT_TYPES)
  incidentType: string;

  @ApiPropertyOptional({ example: 'Bazen, prizemlje' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUuidLoose()
  involvedGuestId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUuidLoose()
  involvedEmployeeId?: string;

  @ApiProperty({ example: 'Gost se okliznuo pored bazena.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ enum: INCIDENT_SEVERITIES, default: 'low' })
  @IsOptional()
  @IsIn(INCIDENT_SEVERITIES)
  severity?: string;

  @ApiPropertyOptional({ type: [String], description: 'Reference na dokaze (fotografije, izjave)' })
  @IsOptional()
  @IsArray()
  evidenceRefs?: string[];
}

export class UpdateIncidentDto {
  @ApiPropertyOptional({ enum: INCIDENT_STATUSES })
  @IsOptional()
  @IsIn(INCIDENT_STATUSES)
  status?: string;

  @ApiPropertyOptional({ enum: INCIDENT_SEVERITIES })
  @IsOptional()
  @IsIn(INCIDENT_SEVERITIES)
  severity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rootCause?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  insuranceClaimReference?: string;
}

export class IncidentFilterDto {
  @ApiPropertyOptional({ enum: INCIDENT_STATUSES })
  @IsOptional()
  @IsIn(INCIDENT_STATUSES)
  status?: string;

  @ApiPropertyOptional({ enum: INCIDENT_TYPES })
  @IsOptional()
  @IsIn(INCIDENT_TYPES)
  incidentType?: string;

  @ApiPropertyOptional({ enum: INCIDENT_SEVERITIES })
  @IsOptional()
  @IsIn(INCIDENT_SEVERITIES)
  severity?: string;
}
