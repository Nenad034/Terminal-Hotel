import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
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
  ) {}

  async login(dto: LoginDto) {
    const employee = await this.prisma.employee.findUnique({
      where: {
        uq_employee_property_email: {
          propertyId: dto.propertyId,
          email: dto.email,
        },
      },
      include: { role: true },
    });

    if (!employee || !employee.isActive) {
      throw new UnauthorizedException('Pogrešan email ili lozinka.');
    }

    const passwordMatches = await bcrypt.compare(dto.password, employee.passwordHash);
    if (!passwordMatches) {
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
