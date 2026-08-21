import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const TASK_TYPES = ['housekeeping', 'maintenance', 'guest_request', 'lost_found', 'other'];
export const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
export const TASK_STATUSES = ['open', 'in_progress', 'completed', 'cancelled'];

export class CreateTaskDto {
  @ApiProperty({ enum: TASK_TYPES })
  @IsIn(TASK_TYPES)
  taskType: string;

  @ApiPropertyOptional({ enum: TASK_PRIORITIES, default: 'normal' })
  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: string;

  @ApiProperty({ example: 'Curi slavina u kupatilu' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'UUID sobe na koju se zadatak odnosi' })
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @ApiPropertyOptional({ description: 'UUID rezervacije (za goste-inicirane zahteve)' })
  @IsOptional()
  @IsUUID()
  reservationId?: string;

  @ApiPropertyOptional({ description: 'UUID zaposlenog kome se odmah dodeljuje zadatak' })
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueAt?: string;
}

export class UpdateTaskDto {
  @ApiPropertyOptional({ enum: TASK_STATUSES })
  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: string;

  @ApiPropertyOptional({ enum: TASK_PRIORITIES })
  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: string;

  @ApiPropertyOptional({ description: 'UUID zaposlenog — dodela ili predaja zadatka' })
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueAt?: string;
}

export class TaskFilterDto {
  @ApiPropertyOptional({ enum: TASK_STATUSES })
  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: string;

  @ApiPropertyOptional({ enum: TASK_TYPES })
  @IsOptional()
  @IsIn(TASK_TYPES)
  taskType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiPropertyOptional({ enum: TASK_PRIORITIES })
  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: string;
}
