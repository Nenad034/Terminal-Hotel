import { IsOptional, IsISO8601, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export class AuditQueryDto {
  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-08-31' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ description: 'UUID zaposlenog koji je izvršio akciju' })
  @IsOptional()
  @IsUuidLoose()
  actorEmployeeId?: string;

  @ApiPropertyOptional({ example: 'Rooms', description: 'Naziv kontrolera (bez "Controller" sufiksa)' })
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiPropertyOptional({ example: 'updateRoomStatus', description: 'Deo naziva akcije (contains)' })
  @IsOptional()
  @IsString()
  action?: string;
}
