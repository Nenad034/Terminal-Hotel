import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCertificationDto } from './dto/hr.dto';

@Injectable()
export class CertificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertEmployeeInProperty(propertyId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, propertyId } });
    if (!employee) throw new NotFoundException(`Zaposleni ${employeeId} nije pronađen.`);
  }

  async createCertification(propertyId: string, employeeId: string, dto: CreateCertificationDto) {
    await this.assertEmployeeInProperty(propertyId, employeeId);
    return this.prisma.staffCertification.create({
      data: {
        employeeId,
        certificationType: dto.certificationType,
        issuedAt: new Date(dto.issuedAt),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        verifiedByEmployeeId: dto.verifiedByEmployeeId,
        documentReference: dto.documentReference,
      },
    });
  }

  async findForEmployee(propertyId: string, employeeId: string) {
    await this.assertEmployeeInProperty(propertyId, employeeId);
    return this.prisma.staffCertification.findMany({
      where: { employeeId },
      orderBy: { expiresAt: 'asc' },
    });
  }

  /** Compliance alert list — sertifikati koji ističu u narednih `days` dana ili su već istekli. */
  async findExpiring(propertyId: string, days: number) {
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + days);
    horizon.setHours(23, 59, 59, 999);

    return this.prisma.staffCertification.findMany({
      where: {
        employee: { propertyId },
        expiresAt: { lte: horizon },
      },
      include: { employee: { select: { firstName: true, lastName: true, roleId: true } } },
      orderBy: { expiresAt: 'asc' },
    });
  }
}
