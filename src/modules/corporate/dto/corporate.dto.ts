import { IsString, IsNotEmpty, IsOptional, IsISO8601 } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCorporateAccountDto {
  @ApiProperty({ example: 'Acme Export DOO' })
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsISO8601()
  contractStart?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsISO8601()
  contractEnd?: string;

  @ApiPropertyOptional({
    example: 'ACME2026',
    description: 'Kod koji gost unosi pri rezervaciji — izostavi da se generiše automatski',
  })
  @IsOptional()
  @IsString()
  accessCode?: string;
}

export class UpdateCorporateAccountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  contractStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  contractEnd?: string;
}
