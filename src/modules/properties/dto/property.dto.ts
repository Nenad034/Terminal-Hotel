import { IsString, IsOptional, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Boutique Hospitality Group' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class CreatePropertyDto {
  @ApiProperty({ example: 'Grand Hotel Belgrade' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Europe/Belgrade' })
  @IsString()
  @IsNotEmpty()
  timezone: string;

  @ApiProperty({ example: 'RSD', description: 'ISO 4217 valutni kod' })
  @IsString()
  @Length(3, 3)
  currency: string;

  @ApiPropertyOptional({ example: { street: 'Knez Mihailova 1', city: 'Beograd', country: 'RS' } })
  @IsOptional()
  address?: Record<string, any>;
}

export class UpdatePropertyDto {
  @ApiPropertyOptional({ example: 'Grand Hotel Belgrade' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Europe/Belgrade' })
  @IsOptional()
  @IsString()
  timezone?: string;
}
