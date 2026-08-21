import { IsOptional, IsISO8601 } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FinanceQueryDto {
  @ApiPropertyOptional({ example: '2026-08-01', description: 'Podrazumevano: početak tekućeg meseca' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-08-31', description: 'Podrazumevano: danas' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class ExportJournalDto {
  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-08-31' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
