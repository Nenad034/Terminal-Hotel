import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsIn,
  IsISO8601,
  IsNumber,
  Min,
} from 'class-validator';
import { IsUuidLoose } from '../../../common/validators/is-uuid-loose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const OUTLET_TYPES = ['restaurant', 'bar'];
export const TABLE_STATUSES = ['available', 'occupied', 'reserved', 'blocked'];
export const DINING_RES_STATUSES = ['booked', 'seated', 'completed', 'cancelled', 'no_show'];

export class CreateOutletDto {
  @ApiProperty({ example: 'Restoran Metropol' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ enum: OUTLET_TYPES, default: 'restaurant' })
  @IsOptional()
  @IsIn(OUTLET_TYPES)
  outletType?: string;

  @ApiPropertyOptional({ example: 80 })
  @IsOptional()
  @IsInt()
  @Min(0)
  totalSeats?: number;
}

export class CreateTableDto {
  @ApiProperty({ example: 'T01' })
  @IsString()
  @IsNotEmpty()
  tableNumber: string;

  @ApiPropertyOptional({ example: 4, default: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  seatCapacity?: number;
}

export class UpdateTableStatusDto {
  @ApiProperty({ enum: TABLE_STATUSES })
  @IsIn(TABLE_STATUSES)
  status: string;
}

export class CreateDiningReservationDto {
  @ApiPropertyOptional({ description: 'UUID stola — ostavi prazno za walk-in bez dodele stola' })
  @IsOptional()
  @IsUuidLoose()
  tableId?: string;

  @ApiPropertyOptional({ description: 'UUID gosta (opciono, walk-in nema profil)' })
  @IsOptional()
  @IsUuidLoose()
  guestProfileId?: string;

  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(1)
  partySize: number;

  @ApiProperty({ example: '2026-09-01T19:00:00.000Z' })
  @IsISO8601()
  reservationTime: string;

  @ApiPropertyOptional({ example: 90, default: 90 })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutesEstimate?: number;
}

export class UpdateDiningReservationDto {
  @ApiProperty({ enum: DINING_RES_STATUSES })
  @IsIn(DINING_RES_STATUSES)
  status: string;
}

/**
 * "Post to room" — Toast Tender obrazac (pogl. 5): POS traži gosta po broju
 * sobe, knjiži na njegov otvoren folio. Ne zahteva folioId — pronalazi se
 * preko aktivne (checked_in) rezervacije sobe.
 */
export class PostToRoomDto {
  @ApiProperty({ example: '204', description: 'Broj sobe gosta koji plaća račun' })
  @IsString()
  @IsNotEmpty()
  roomNumber: string;

  @ApiProperty({ example: 'Večera — sto T04 (2 osobe)' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 4500.0 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ example: 0.2, description: 'PDV stopa za F&B (podrazumevano 0.2)' })
  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @ApiPropertyOptional({ description: 'UUID zaposlenog (konobar/kasir) koji knjiži' })
  @IsOptional()
  @IsUuidLoose()
  postedBy?: string;
}
