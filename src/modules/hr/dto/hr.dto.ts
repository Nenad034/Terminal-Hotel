import { IsString, IsNotEmpty, IsOptional, IsIn, IsISO8601 } from 'class-validator';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const SHIFT_STATUSES = ['open', 'assigned', 'confirmed', 'completed', 'no_show', 'cancelled'];
export const TIME_CLOCK_EVENT_TYPES = ['clock_in', 'clock_out', 'break_start', 'break_end'];
export const TIME_CLOCK_SOURCES = ['badge', 'biometric', 'manual', 'mobile'];

// ─── Shifts ─────────────────────────────────────────────────────────────────

export class CreateShiftDto {
  @ApiProperty({ description: 'UUID uloge za koju se smena otvara' })
  @IsUuidLoose()
  roleId: string;

  @ApiPropertyOptional({ description: 'UUID zaposlenog — ostavi prazno za open smenu' })
  @IsOptional()
  @IsUuidLoose()
  employeeId?: string;

  @ApiProperty({ example: '2026-09-01T06:00:00.000Z' })
  @IsISO8601()
  startAt: string;

  @ApiProperty({ example: '2026-09-01T14:00:00.000Z' })
  @IsISO8601()
  endAt: string;

  @ApiPropertyOptional({ example: 'manual', default: 'manual' })
  @IsOptional()
  @IsString()
  forecastSource?: string;
}

export class AssignShiftDto {
  @ApiProperty({ description: 'UUID zaposlenog koji preuzima smenu' })
  @IsUuidLoose()
  employeeId: string;
}

export class UpdateShiftStatusDto {
  @ApiProperty({ enum: SHIFT_STATUSES })
  @IsIn(SHIFT_STATUSES)
  status: string;
}

export class ShiftFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUuidLoose()
  employeeId?: string;

  @ApiPropertyOptional({ enum: SHIFT_STATUSES })
  @IsOptional()
  @IsIn(SHIFT_STATUSES)
  status?: string;
}

// ─── Time Clock ─────────────────────────────────────────────────────────────

export class CreateTimeClockEventDto {
  @ApiPropertyOptional({ description: 'UUID zaposlenog — izostavi da probije sopstveni karton' })
  @IsOptional()
  @IsUuidLoose()
  employeeId?: string;

  @ApiProperty({ enum: TIME_CLOCK_EVENT_TYPES })
  @IsIn(TIME_CLOCK_EVENT_TYPES)
  eventType: string;

  @ApiPropertyOptional({ enum: TIME_CLOCK_SOURCES, default: 'manual' })
  @IsOptional()
  @IsIn(TIME_CLOCK_SOURCES)
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceReference?: string;
}

export class TimesheetQueryDto {
  @ApiProperty({ example: '2026-08-01' })
  @IsISO8601()
  from: string;

  @ApiProperty({ example: '2026-08-31' })
  @IsISO8601()
  to: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUuidLoose()
  employeeId?: string;
}

// ─── Certifications ─────────────────────────────────────────────────────────

export class CreateCertificationDto {
  @ApiProperty({ example: 'HACCP osnovni' })
  @IsString()
  @IsNotEmpty()
  certificationType: string;

  @ApiProperty({ example: '2026-01-15' })
  @IsISO8601()
  issuedAt: string;

  @ApiPropertyOptional({ example: '2027-01-15' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'UUID zaposlenog koji je verifikovao sertifikat' })
  @IsOptional()
  @IsUuidLoose()
  verifiedByEmployeeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  documentReference?: string;
}
