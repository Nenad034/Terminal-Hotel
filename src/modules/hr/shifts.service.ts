import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateShiftDto, AssignShiftDto, UpdateShiftStatusDto, ShiftFilterDto } from './dto/hr.dto';

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  async createShift(propertyId: string, dto: CreateShiftDto) {
    const role = await this.prisma.role.findFirst({ where: { id: dto.roleId, propertyId } });
    if (!role) throw new NotFoundException(`Uloga ${dto.roleId} nije pronađena.`);

    if (dto.employeeId) {
      await this.assertCertificationsValid(dto.employeeId);
    }

    return this.prisma.shift.create({
      data: {
        propertyId,
        roleId: dto.roleId,
        employeeId: dto.employeeId,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        status: dto.employeeId ? 'assigned' : 'open',
        forecastSource: dto.forecastSource ?? 'manual',
      },
      include: { role: { select: { name: true } }, employee: { select: { firstName: true, lastName: true } } },
    });
  }

  async findShifts(propertyId: string, filter: ShiftFilterDto) {
    return this.prisma.shift.findMany({
      where: {
        propertyId,
        ...(filter.employeeId && { employeeId: filter.employeeId }),
        ...(filter.status && { status: filter.status }),
        ...(filter.from && { startAt: { gte: new Date(filter.from) } }),
        ...(filter.to && { endAt: { lte: new Date(filter.to) } }),
      },
      include: { role: { select: { name: true } }, employee: { select: { firstName: true, lastName: true } } },
      orderBy: { startAt: 'asc' },
    });
  }

  private async findShiftOrThrow(propertyId: string, shiftId: string) {
    const shift = await this.prisma.shift.findFirst({ where: { id: shiftId, propertyId } });
    if (!shift) throw new NotFoundException(`Smena ${shiftId} nije pronađena.`);
    return shift;
  }

  /**
   * Diferencijator iz pogl. 19: "istekla sertifikacija blokira dodelu smene" —
   * nijedan javno dokumentovan WFM vendor ovo ne radi nativno. Proverava SVE
   * sertifikate zaposlenog; bilo koji istekao (expiresAt < danas) blokira dodelu.
   */
  private async assertCertificationsValid(employeeId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expired = await this.prisma.staffCertification.findMany({
      where: { employeeId, expiresAt: { lt: today } },
    });

    if (expired.length > 0) {
      const types = expired.map((c) => c.certificationType).join(', ');
      throw new BadRequestException(
        `Zaposleni ima istekle sertifikate (${types}) — dodela smene je blokirana dok se ne obnove.`,
      );
    }
  }

  async assignShift(propertyId: string, shiftId: string, dto: AssignShiftDto) {
    const shift = await this.findShiftOrThrow(propertyId, shiftId);
    if (shift.status !== 'open') {
      throw new BadRequestException(`Smena u statusu '${shift.status}' se ne može dodeliti.`);
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, propertyId, isActive: true },
    });
    if (!employee) throw new NotFoundException(`Aktivan zaposleni ${dto.employeeId} nije pronađen.`);

    await this.assertCertificationsValid(dto.employeeId);

    return this.prisma.shift.update({
      where: { id: shiftId },
      data: { employeeId: dto.employeeId, status: 'assigned' },
      include: { role: { select: { name: true } }, employee: { select: { firstName: true, lastName: true } } },
    });
  }

  async updateShiftStatus(propertyId: string, shiftId: string, dto: UpdateShiftStatusDto) {
    const shift = await this.findShiftOrThrow(propertyId, shiftId);
    if (['completed', 'cancelled', 'no_show'].includes(shift.status)) {
      throw new BadRequestException(`Smena u statusu '${shift.status}' se ne može više menjati.`);
    }
    return this.prisma.shift.update({ where: { id: shiftId }, data: { status: dto.status } });
  }
}
