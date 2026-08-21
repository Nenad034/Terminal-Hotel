import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsISO8601,
  IsIn,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddChargeDto {
  @ApiProperty({ example: '2026-09-01' })
  @IsISO8601()
  chargeDate: string;

  @ApiProperty({ example: 'Noćenje — Standard Double' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 'accommodation', description: 'Kategorija prihoda za GL' })
  @IsString()
  @IsNotEmpty()
  revenueCategory: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiProperty({ example: 12000.00 })
  @IsNumber()
  unitPrice: number;

  @ApiPropertyOptional({ example: 0.1, description: 'Stopa PDV-a (0.0 – 1.0)' })
  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @ApiPropertyOptional({ description: 'UUID zaposlenog koji knjiži' })
  @IsOptional()
  @IsUUID()
  postedBy?: string;
}

export class AddPaymentDto {
  @ApiProperty({ example: 12000.00 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ example: 'RSD', default: 'RSD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({
    example: 'cash',
    enum: ['cash', 'card', 'bank_transfer', 'package_operator', 'loyalty_points', 'voucher'],
  })
  @IsIn(['cash', 'card', 'bank_transfer', 'package_operator', 'loyalty_points', 'voucher'])
  method: string;

  @ApiPropertyOptional({ description: 'Token plaćanja (za kartičnu naplatu)' })
  @IsOptional()
  @IsString()
  paymentToken?: string;

  @ApiPropertyOptional({ description: 'Interni referentni broj' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  postedBy?: string;
}

export class VoidChargeDto {
  @ApiPropertyOptional({ description: 'Razlog storniranja' })
  @IsOptional()
  @IsString()
  reason?: string;
}
