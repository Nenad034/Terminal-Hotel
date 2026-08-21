import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEmail,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGuestDto {
  @ApiProperty({ example: 'Marko' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Petrović' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiPropertyOptional({ example: 'marko@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+381641234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'passport', enum: ['passport', 'id_card', 'drivers_license'] })
  @IsOptional()
  @IsIn(['passport', 'id_card', 'drivers_license'])
  idDocumentType?: string;

  @ApiPropertyOptional({ example: 'SRB123456' })
  @IsOptional()
  @IsString()
  idDocumentNumber?: string;

  @ApiPropertyOptional({ example: 'RS', description: 'ISO 3166-1 alpha-2 kod države' })
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional({ default: false, description: 'GDPR saglasnost za marketing' })
  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;

  @ApiPropertyOptional({ example: { pillowType: 'soft', roomFloor: 'high' } })
  @IsOptional()
  preferences?: Record<string, any>;
}

export class UpdateGuestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  preferences?: Record<string, any>;
}

export class GuestSearchDto {
  @ApiPropertyOptional({ example: 'Petrović' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  loyaltyNumber?: string;
}
