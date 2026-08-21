import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CorrectiveActionsService } from './corrective-actions.service';
import { CreateHaccpLogDto, HaccpLogFilterDto, CreateCorrectiveActionDto } from './dto/compliance.dto';

@Injectable()
export class HaccpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly correctiveActionsService: CorrectiveActionsService,
  ) {}

  /** passFail je uvek izvedeno iz kritičnih limita — nikad ručni unos (pogl. 23). */
  private computePassFail(readingValue: number, thresholdMin?: number, thresholdMax?: number): boolean {
    if (thresholdMin !== undefined && readingValue < thresholdMin) return false;
    if (thresholdMax !== undefined && readingValue > thresholdMax) return false;
    return true;
  }

  async createLog(propertyId: string, actingEmployeeId: string, dto: CreateHaccpLogDto) {
    const passFail = this.computePassFail(dto.readingValue, dto.thresholdMin, dto.thresholdMax);

    return this.prisma.haccpCcpLog.create({
      data: {
        propertyId,
        ccpType: dto.ccpType,
        locationReference: dto.locationReference,
        readingValue: dto.readingValue,
        unit: dto.unit ?? 'C',
        thresholdMin: dto.thresholdMin,
        thresholdMax: dto.thresholdMax,
        passFail,
        staffEmployeeId: dto.staffEmployeeId ?? actingEmployeeId,
      },
    });
  }

  async findLogs(propertyId: string, filter: HaccpLogFilterDto) {
    return this.prisma.haccpCcpLog.findMany({
      where: {
        propertyId,
        ...(filter.ccpType && { ccpType: filter.ccpType }),
        ...(filter.passFail !== undefined && { passFail: filter.passFail }),
        ...(filter.from || filter.to
          ? { occurredAt: { ...(filter.from && { gte: new Date(filter.from) }), ...(filter.to && { lte: new Date(filter.to) }) } }
          : {}),
      },
      include: { staffEmployee: { select: { firstName: true, lastName: true } }, correctiveAction: true },
      orderBy: { occurredAt: 'desc' },
    });
  }

  /** Compliance alarm — neuspela merenja koja još nemaju korektivnu akciju. */
  async findUnresolvedFailures(propertyId: string) {
    return this.prisma.haccpCcpLog.findMany({
      where: { propertyId, passFail: false, correctiveActionId: null },
      orderBy: { occurredAt: 'desc' },
    });
  }

  async attachCorrectiveAction(
    propertyId: string,
    actingEmployeeId: string,
    logId: string,
    dto: CreateCorrectiveActionDto,
  ) {
    const log = await this.prisma.haccpCcpLog.findFirst({ where: { id: logId, propertyId } });
    if (!log) throw new NotFoundException(`HACCP zapis ${logId} nije pronađen.`);
    if (log.correctiveActionId) {
      throw new BadRequestException('Ovaj zapis već ima korektivnu akciju.');
    }

    const action = await this.correctiveActionsService.create(propertyId, actingEmployeeId, dto);
    return this.prisma.haccpCcpLog.update({
      where: { id: logId },
      data: { correctiveActionId: action.id },
      include: { correctiveAction: true },
    });
  }
}
