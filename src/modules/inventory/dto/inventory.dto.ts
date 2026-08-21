import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsIn,
  IsUUID,
  IsEmail,
  IsArray,
  ValidateNested,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const LOCATION_TYPES = ['warehouse', 'kitchen', 'bar', 'housekeeping', 'spa_retail', 'room_minibar'];
export const DEPLETION_REASONS = ['waste', 'spoilage', 'theft', 'other'];
export const PO_STATUSES = ['draft', 'submitted', 'received', 'cancelled'];

// ─── Vendor ─────────────────────────────────────────────────────────────────

export class CreateVendorDto {
  @ApiProperty({ example: 'Metro Cash & Carry' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;
}

// ─── Inventory Location ─────────────────────────────────────────────────────

export class CreateLocationDto {
  @ApiProperty({ example: 'Centralni magacin' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: LOCATION_TYPES })
  @IsIn(LOCATION_TYPES)
  locationType: string;

  @ApiPropertyOptional({ description: 'UUID roditeljske lokacije (rekurzivna hijerarhija)' })
  @IsOptional()
  @IsUUID()
  parentLocationId?: string;
}

// ─── Inventory Item ─────────────────────────────────────────────────────────

export class CreateItemDto {
  @ApiProperty({ example: 'MLK-1L' })
  @IsString()
  @IsNotEmpty()
  sku: string;

  @ApiProperty({ example: 'Mleko 3.2%' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'l' })
  @IsString()
  @IsNotEmpty()
  unit: string;

  @ApiPropertyOptional({ example: 'food' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 150, description: 'Nivo za reorder alarm' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderLevel?: number;
}

// ─── Purchase Order ─────────────────────────────────────────────────────────

export class PurchaseOrderLineDto {
  @ApiProperty()
  @IsUUID()
  itemId: string;

  @ApiProperty({ example: 50 })
  @IsNumber()
  @Min(0.001)
  quantityOrdered: number;

  @ApiProperty({ example: 120.5 })
  @IsNumber()
  @Min(0)
  unitCost: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty()
  @IsUUID()
  vendorId: string;

  @ApiPropertyOptional({ example: '2026-09-05' })
  @IsOptional()
  @IsString()
  expectedDate?: string;

  @ApiProperty({ type: [PurchaseOrderLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineDto)
  lines: PurchaseOrderLineDto[];
}

export class UpdatePurchaseOrderStatusDto {
  @ApiProperty({ enum: PO_STATUSES })
  @IsIn(PO_STATUSES)
  status: string;
}

// ─── Receipt (3-way match) ──────────────────────────────────────────────────

export class ReceiptLineDto {
  @ApiProperty()
  @IsUUID()
  itemId: string;

  @ApiProperty({ example: 50 })
  @IsNumber()
  @Min(0.001)
  quantityReceived: number;

  @ApiProperty({ example: 120.5 })
  @IsNumber()
  @Min(0)
  unitCost: number;
}

export class CreateReceiptDto {
  @ApiPropertyOptional({ description: 'UUID narudžbenice (izostavi za direktan prijem bez PO)' })
  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @ApiProperty({ description: 'UUID lokacije na koju se roba prima' })
  @IsUUID()
  locationId: string;

  @ApiPropertyOptional({ description: 'UUID zaposlenog koji prima robu' })
  @IsOptional()
  @IsUUID()
  receivedBy?: string;

  @ApiProperty({ type: [ReceiptLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiptLineDto)
  lines: ReceiptLineDto[];
}

// ─── Transfer ────────────────────────────────────────────────────────────────

export class TransferLineDto {
  @ApiProperty()
  @IsUUID()
  itemId: string;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(0.001)
  quantity: number;
}

export class CreateTransferDto {
  @ApiProperty()
  @IsUUID()
  fromLocationId: string;

  @ApiProperty()
  @IsUUID()
  toLocationId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  requestedBy?: string;

  @ApiProperty({ type: [TransferLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TransferLineDto)
  lines: TransferLineDto[];
}

// ─── Depletion / Waste ───────────────────────────────────────────────────────

export class CreateDepletionDto {
  @ApiProperty()
  @IsUUID()
  locationId: string;

  @ApiProperty()
  @IsUUID()
  itemId: string;

  @ApiProperty({ example: 2.5 })
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiProperty({ enum: DEPLETION_REASONS })
  @IsIn(DEPLETION_REASONS)
  reason: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// ─── Recipe ──────────────────────────────────────────────────────────────────

export class RecipeIngredientDto {
  @ApiProperty()
  @IsUUID()
  itemId: string;

  @ApiProperty({ example: 0.2 })
  @IsNumber()
  @Min(0.001)
  quantity: number;
}

export class CreateRecipeDto {
  @ApiProperty({ example: 'Sarma (porcija)' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0.001)
  yieldQuantity?: number;

  @ApiPropertyOptional({ example: 'portion', default: 'portion' })
  @IsOptional()
  @IsString()
  yieldUnit?: string;

  @ApiPropertyOptional({ example: 0.3, description: 'Ciljani food cost % (0.0–1.0) za predlog cene' })
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  targetFoodCostPercent?: number;

  @ApiProperty({ type: [RecipeIngredientDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients: RecipeIngredientDto[];
}
