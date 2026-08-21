import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateEsgMetricDto, CreateCertificationDto, UpdateCertificationDto } from './dto/esg.dto';

const CARBON_METRIC_TYPES = ['carbon_scope1', 'carbon_scope2', 'carbon_scope3'];

@Injectable()
export class EsgService {
  constructor(private readonly prisma: PrismaService) {}

  createMetric(propertyId: string, dto: CreateEsgMetricDto) {
    return this.prisma.esgMetric.create({
      data: {
        propertyId,
        metricType: dto.metricType,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        value: dto.value,
        unit: dto.unit,
        source: dto.source ?? 'manual',
      },
    });
  }

  findMetrics(propertyId: string, from?: string, to?: string) {
    return this.prisma.esgMetric.findMany({
      where: {
        propertyId,
        ...(from && { periodStart: { gte: new Date(from) } }),
        ...(to && { periodEnd: { lte: new Date(to) } }),
      },
      orderBy: { periodStart: 'desc' },
    });
  }

  /**
   * HCMI (Hotel Carbon Measurement Initiative): karbon (scope 1+2+3, kgCO2e) po
   * zauzetoj sobi/noći. Zauzete sobe/noći se čitaju iz occupancy_snapshot_daily
   * (upisuje ga noćni audit, pogl. WorkersService) — bez zavisnosti od M14.
   */
  async getHcmi(propertyId: string, from: string, to: string) {
    const [carbonMetrics, occupancySnapshots] = await Promise.all([
      this.prisma.esgMetric.findMany({
        where: {
          propertyId,
          metricType: { in: CARBON_METRIC_TYPES },
          periodStart: { gte: new Date(from) },
          periodEnd: { lte: new Date(to) },
        },
      }),
      this.prisma.occupancySnapshotDaily.findMany({
        where: {
          propertyId,
          resourceType: 'ROOM',
          snapshotDate: { gte: new Date(from), lte: new Date(to) },
        },
      }),
    ]);

    const byScope = { carbon_scope1: 0, carbon_scope2: 0, carbon_scope3: 0 } as Record<string, number>;
    for (const m of carbonMetrics) byScope[m.metricType] += Number(m.value);
    const totalCarbonKg = byScope.carbon_scope1 + byScope.carbon_scope2 + byScope.carbon_scope3;

    const occupiedRoomNights = occupancySnapshots.reduce((sum, s) => sum + s.occupiedUnits, 0);

    return {
      propertyId,
      period: { from, to },
      carbonKgCo2e: { scope1: byScope.carbon_scope1, scope2: byScope.carbon_scope2, scope3: byScope.carbon_scope3, total: totalCarbonKg },
      occupiedRoomNights,
      hcmiKgCo2ePerOccupiedRoomNight: occupiedRoomNights > 0 ? Number((totalCarbonKg / occupiedRoomNights).toFixed(4)) : null,
      note: occupiedRoomNights === 0 ? 'Nema occupancy_snapshot_daily zapisa za period — pokrenite noćni audit ili proverite opseg.' : undefined,
    };
  }

  createCertification(propertyId: string, dto: CreateCertificationDto) {
    return this.prisma.certification.create({
      data: {
        propertyId,
        program: dto.program,
        auditDate: dto.auditDate ? new Date(dto.auditDate) : undefined,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
      },
    });
  }

  findCertifications(propertyId: string) {
    return this.prisma.certification.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateCertification(propertyId: string, id: string, dto: UpdateCertificationDto) {
    const existing = await this.prisma.certification.findFirst({ where: { id, propertyId } });
    if (!existing) throw new NotFoundException(`Sertifikat ${id} nije pronađen.`);

    return this.prisma.certification.update({
      where: { id },
      data: {
        ...(dto.status && { status: dto.status }),
        ...(dto.auditDate !== undefined && { auditDate: new Date(dto.auditDate) }),
        ...(dto.expiryDate !== undefined && { expiryDate: new Date(dto.expiryDate) }),
      },
    });
  }
}
