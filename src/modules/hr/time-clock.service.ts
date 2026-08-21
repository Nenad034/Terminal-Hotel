import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateTimeClockEventDto } from './dto/hr.dto';

export interface TimesheetRow {
  employeeId: string;
  firstName: string;
  lastName: string;
  workedHours: number;
  breakHours: number;
  events: number;
}

@Injectable()
export class TimeClockService {
  constructor(private readonly prisma: PrismaService) {}

  async createEvent(propertyId: string, actingEmployeeId: string, dto: CreateTimeClockEventDto) {
    const employeeId = dto.employeeId ?? actingEmployeeId;

    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, propertyId, isActive: true },
    });
    if (!employee) throw new NotFoundException(`Aktivan zaposleni ${employeeId} nije pronađen.`);

    return this.prisma.timeClockEvent.create({
      data: {
        employeeId,
        propertyId,
        eventType: dto.eventType,
        source: dto.source ?? 'manual',
        deviceReference: dto.deviceReference,
      },
    });
  }

  async findEvents(propertyId: string, employeeId?: string) {
    return this.prisma.timeClockEvent.findMany({
      where: { propertyId, ...(employeeId && { employeeId }) },
      orderBy: { occurredAt: 'desc' },
      take: 200,
    });
  }

  /**
   * Payroll export obrazac (pogl. 19): izvoz odobrenih sati po ciklusu, ne
   * live API. Sparuje clock_in→clock_out (radno vreme) i break_start→break_end
   * (pauze, oduzimaju se od radnog vremena) hronološki po zaposlenom.
   */
  async getTimesheet(propertyId: string, from: Date, to: Date, employeeId?: string) {
    const events = await this.prisma.timeClockEvent.findMany({
      where: {
        propertyId,
        occurredAt: { gte: from, lte: to },
        ...(employeeId && { employeeId }),
      },
      include: { employee: { select: { firstName: true, lastName: true } } },
      orderBy: { occurredAt: 'asc' },
    });

    const byEmployee = new Map<string, typeof events>();
    for (const e of events) {
      if (!byEmployee.has(e.employeeId)) byEmployee.set(e.employeeId, []);
      byEmployee.get(e.employeeId)!.push(e);
    }

    const rows: TimesheetRow[] = [];
    for (const [employeeId, empEvents] of byEmployee) {
      let workedMs = 0;
      let breakMs = 0;
      let openClockIn: Date | null = null;
      let openBreakStart: Date | null = null;

      for (const e of empEvents) {
        if (e.eventType === 'clock_in') openClockIn = e.occurredAt;
        else if (e.eventType === 'clock_out' && openClockIn) {
          workedMs += e.occurredAt.getTime() - openClockIn.getTime();
          openClockIn = null;
        } else if (e.eventType === 'break_start') openBreakStart = e.occurredAt;
        else if (e.eventType === 'break_end' && openBreakStart) {
          breakMs += e.occurredAt.getTime() - openBreakStart.getTime();
          openBreakStart = null;
        }
      }

      rows.push({
        employeeId,
        firstName: empEvents[0].employee.firstName,
        lastName: empEvents[0].employee.lastName,
        workedHours: Math.round(((workedMs - breakMs) / 3600000) * 100) / 100,
        breakHours: Math.round((breakMs / 3600000) * 100) / 100,
        events: empEvents.length,
      });
    }

    return {
      period: { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] },
      rows,
    };
  }
}
