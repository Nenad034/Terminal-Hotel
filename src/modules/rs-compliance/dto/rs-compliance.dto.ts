import { IsOptional, IsISO8601 } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';

export class CreateSefInvoiceDto {
  @ApiProperty({ example: '00000000-0000-0000-0000-000000000501' })
  @IsUuidLoose()
  folioId: string;

  @ApiPropertyOptional({ example: '00000000-0000-0000-0000-000000000801' })
  @IsOptional()
  @IsUuidLoose()
  corporateAccountId?: string;
}

export class CreateEturistaBatchDto {
  @ApiProperty({ example: '2026-08-01' })
  @IsISO8601()
  periodStart: string;

  @ApiProperty({ example: '2026-08-31' })
  @IsISO8601()
  periodEnd: string;
}
