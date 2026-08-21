import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiParam } from '@nestjs/swagger';
import { ShiftsService } from './shifts.service';
import { TimeClockService } from './time-clock.service';
import { CertificationsService } from './certifications.service';
import {
  CreateShiftDto,
  AssignShiftDto,
  UpdateShiftStatusDto,
  ShiftFilterDto,
  CreateTimeClockEventDto,
  TimesheetQueryDto,
  CreateCertificationDto,
} from './dto/hr.dto';
import { PropertyId } from '../../common/decorators/tenant.decorator';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtPayload } from '../auth/auth.service';

@ApiTags('HR / Radna snaga')
@ApiSecurity('property-context')
@Controller()
export class HrController {
  constructor(
    private readonly shiftsService: ShiftsService,
    private readonly timeClockService: TimeClockService,
    private readonly certificationsService: CertificationsService,
  ) {}

  // ─── Shifts ─────────────────────────────────────────────────────────────────

  @Post('shifts')
  @RequirePermissions('hr:manage')
  @ApiOperation({ summary: 'Otvori smenu (sa ili bez odmah dodeljenog zaposlenog)' })
  createShift(@PropertyId() propertyId: string, @Body() dto: CreateShiftDto) {
    return this.shiftsService.createShift(propertyId, dto);
  }

  @Get('shifts')
  @ApiOperation({ summary: 'Lista smena (filteri: period, zaposleni, status)' })
  findShifts(@PropertyId() propertyId: string, @Query() filter: ShiftFilterDto) {
    return this.shiftsService.findShifts(propertyId, filter);
  }

  @Patch('shifts/:id/assign')
  @RequirePermissions('hr:manage')
  @ApiOperation({
    summary: 'Dodeli otvorenu smenu zaposlenom',
    description: 'Blokirano ako zaposleni ima bilo koji istekao sertifikat (pogl. 19).',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  assignShift(@PropertyId() propertyId: string, @Param('id') id: string, @Body() dto: AssignShiftDto) {
    return this.shiftsService.assignShift(propertyId, id, dto);
  }

  @Patch('shifts/:id/status')
  @RequirePermissions('hr:manage')
  @ApiOperation({ summary: 'Promeni status smene (confirmed/completed/no_show/cancelled)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  updateShiftStatus(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateShiftStatusDto,
  ) {
    return this.shiftsService.updateShiftStatus(propertyId, id, dto);
  }

  // ─── Time Clock ─────────────────────────────────────────────────────────────

  @Post('time-clock/events')
  @ApiOperation({
    summary: 'Probij karton (clock_in/out, break_start/end)',
    description:
      'Bez employeeId u telu probija se karton ulogovanog zaposlenog (self-service). ' +
      'Probijanje kartona za drugog zaposlenog zahteva hr:manage dozvolu.',
  })
  createTimeClockEvent(
    @PropertyId() propertyId: string,
    @CurrentEmployee() employee: JwtPayload,
    @Body() dto: CreateTimeClockEventDto,
  ) {
    if (dto.employeeId && dto.employeeId !== employee.sub && !employee.permissions.includes('*')) {
      if (!employee.permissions.includes('hr:manage')) {
        dto = { ...dto, employeeId: employee.sub };
      }
    }
    return this.timeClockService.createEvent(propertyId, employee.sub, dto);
  }

  @Get('time-clock/events')
  @RequirePermissions('hr:manage')
  @ApiOperation({ summary: 'Istorija probijanja kartona (poslednjih 200)' })
  findTimeClockEvents(@PropertyId() propertyId: string, @Query('employeeId') employeeId?: string) {
    return this.timeClockService.findEvents(propertyId, employeeId);
  }

  @Get('time-clock/timesheet')
  @RequirePermissions('hr:manage')
  @ApiOperation({
    summary: 'Timesheet — odrađeni sati po zaposlenom za period (payroll export obrazac)',
  })
  getTimesheet(@PropertyId() propertyId: string, @Query() query: TimesheetQueryDto) {
    const to = new Date(query.to);
    to.setHours(23, 59, 59, 999);
    return this.timeClockService.getTimesheet(propertyId, new Date(query.from), to, query.employeeId);
  }

  // ─── Certifications ─────────────────────────────────────────────────────────

  @Post('employees/:employeeId/certifications')
  @RequirePermissions('hr:manage')
  @ApiOperation({ summary: 'Evidentiraj sertifikat zaposlenog' })
  @ApiParam({ name: 'employeeId', type: 'string', format: 'uuid' })
  createCertification(
    @PropertyId() propertyId: string,
    @Param('employeeId') employeeId: string,
    @Body() dto: CreateCertificationDto,
  ) {
    return this.certificationsService.createCertification(propertyId, employeeId, dto);
  }

  @Get('employees/:employeeId/certifications')
  @RequirePermissions('hr:manage')
  @ApiOperation({ summary: 'Sertifikati zaposlenog' })
  @ApiParam({ name: 'employeeId', type: 'string', format: 'uuid' })
  findCertifications(@PropertyId() propertyId: string, @Param('employeeId') employeeId: string) {
    return this.certificationsService.findForEmployee(propertyId, employeeId);
  }

  @Get('certifications/expiring')
  @RequirePermissions('hr:manage')
  @ApiOperation({ summary: 'Sertifikati koji ističu uskoro (compliance alarm)' })
  findExpiringCertifications(@PropertyId() propertyId: string, @Query('days') days?: string) {
    return this.certificationsService.findExpiring(propertyId, days ? parseInt(days, 10) : 30);
  }
}
