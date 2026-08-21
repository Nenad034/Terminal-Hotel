import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCorrectiveActionDto } from './dto/compliance.dto';

@Injectable()
export class CorrectiveActionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(propertyId: string, actingEmployeeId: string, dto: CreateCorrectiveActionDto) {
    return this.prisma.correctiveAction.create({
      data: {
        propertyId,
        actionTaken: dto.actionTaken,
        resolvedByEmployeeId: dto.resolvedByEmployeeId ?? actingEmployeeId,
        resolvedAt: new Date(),
      },
    });
  }
}
