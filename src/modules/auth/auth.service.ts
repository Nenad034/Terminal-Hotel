import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';

export interface JwtPayload {
  sub: string; // employeeId
  propertyId: string;
  roleId: string;
  permissions: string[];
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async login(dto: LoginDto) {
    const property = await this.prisma.property.findUnique({
      where: { id: dto.propertyId },
      select: { organizationId: true },
    });

    const employee = await this.prisma.employee.findUnique({
      where: {
        uq_employee_property_email: {
          propertyId: dto.propertyId,
          email: dto.email,
        },
      },
      include: { role: true },
    });

    const passwordMatches =
      employee && (await bcrypt.compare(dto.password, employee.passwordHash).catch(() => false));

    if (!employee || !employee.isActive || !passwordMatches) {
      // SOC 2 minimum (pogl. 22): autentikacija se loguje i kad ne uspe —
      // bez employeeId ako korisnik ne postoji, radi bezbednosnog nadzora.
      if (property) {
        await this.auditService.record({
          organizationId: property.organizationId,
          propertyId: dto.propertyId,
          actorEmployeeId: employee?.id ?? null,
          actorType: 'employee',
          action: 'Auth.loginFailed',
          resourceType: 'Employee',
          resourceId: employee?.id ?? null,
          metadata: { email: dto.email },
        });
      }
      throw new UnauthorizedException('Pogrešan email ili lozinka.');
    }

    const permissions = Array.isArray(employee.role.permissions)
      ? (employee.role.permissions as unknown as string[])
      : [];

    const payload: JwtPayload = {
      sub: employee.id,
      propertyId: employee.propertyId,
      roleId: employee.roleId,
      permissions,
      email: employee.email,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    if (property) {
      await this.auditService.record({
        organizationId: property.organizationId,
        propertyId: dto.propertyId,
        actorEmployeeId: employee.id,
        actorType: 'employee',
        action: 'Auth.loginSuccess',
        resourceType: 'Employee',
        resourceId: employee.id,
      });
    }

    return {
      accessToken,
      employee: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        role: employee.role.name,
        propertyId: employee.propertyId,
      },
    };
  }
}
