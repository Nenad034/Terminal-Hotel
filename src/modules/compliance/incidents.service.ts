import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CorrectiveActionsService } from './corrective-actions.service';
import { CreateIncidentDto, UpdateIncidentDto, IncidentFilterDto, CreateCorrectiveActionDto } from './dto/compliance.dto';

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly correctiveActionsService: CorrectiveActionsService,
  ) {}

  async createIncident(propertyId: string, actingEmployeeId: string, dto: CreateIncidentDto) {
    return this.prisma.incidentReport.create({
      data: {
        propertyId,
        incidentType: dto.incidentType,
        location: dto.location,
        involvedGuestId: dto.involvedGuestId,
        involvedEmployeeId: dto.involvedEmployeeId,
        description: dto.description,
        severity: dto.severity ?? 'low',
        evidenceRefs: dto.evidenceRefs ?? [],
        reportedByEmployeeId: actingEmployeeId,
      },
    });
  }

  async findIncidents(propertyId: string, filter: IncidentFilterDto) {
    return this.prisma.incidentReport.findMany({
      where: {
        propertyId,
        ...(filter.status && { status: filter.status }),
        ...(filter.incidentType && { incidentType: filter.incidentType }),
        ...(filter.severity && { severity: filter.severity }),
      },
      include: { correctiveAction: true },
      orderBy: { occurredAt: 'desc' },
    });
  }

  private async findIncidentOrThrow(propertyId: string, incidentId: string) {
    const incident = await this.prisma.incidentReport.findFirst({ where: { id: incidentId, propertyId } });
    if (!incident) throw new NotFoundException(`Incident ${incidentId} nije pronađen.`);
    return incident;
  }

  async updateIncident(propertyId: string, incidentId: string, dto: UpdateIncidentDto) {
    await this.findIncidentOrThrow(propertyId, incidentId);
    return this.prisma.incidentReport.update({
      where: { id: incidentId },
      data: {
        ...(dto.status && { status: dto.status }),
        ...(dto.severity && { severity: dto.severity }),
        ...(dto.rootCause !== undefined && { rootCause: dto.rootCause }),
        ...(dto.insuranceClaimReference !== undefined && { insuranceClaimReference: dto.insuranceClaimReference }),
      },
    });
  }

  async attachCorrectiveAction(
    propertyId: string,
    actingEmployeeId: string,
    incidentId: string,
    dto: CreateCorrectiveActionDto,
  ) {
    const incident = await this.findIncidentOrThrow(propertyId, incidentId);
    if (incident.correctiveActionId) {
      throw new BadRequestException('Ovaj incident već ima korektivnu akciju.');
    }

    const action = await this.correctiveActionsService.create(propertyId, actingEmployeeId, dto);
    return this.prisma.incidentReport.update({
      where: { id: incidentId },
      data: { correctiveActionId: action.id, status: 'resolved' },
      include: { correctiveAction: true },
    });
  }
}
