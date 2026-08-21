import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { CreateCorporateAccountDto, UpdateCorporateAccountDto } from './dto/corporate.dto';

function generateAccessCode(): string {
  return randomBytes(5).toString('hex').toUpperCase();
}

@Injectable()
export class CorporateService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveOrganizationId(propertyId: string): Promise<string> {
    const property = await this.prisma.property.findUniqueOrThrow({
      where: { id: propertyId },
      select: { organizationId: true },
    });
    return property.organizationId;
  }

  async createAccount(propertyId: string, dto: CreateCorporateAccountDto) {
    const organizationId = await this.resolveOrganizationId(propertyId);
    const accessCode = dto.accessCode ?? generateAccessCode();

    const existing = await this.prisma.corporateAccount.findUnique({ where: { accessCode } });
    if (existing) throw new ConflictException(`Access code '${accessCode}' je već u upotrebi.`);

    return this.prisma.corporateAccount.create({
      data: {
        organizationId,
        companyName: dto.companyName,
        contractStart: dto.contractStart ? new Date(dto.contractStart) : undefined,
        contractEnd: dto.contractEnd ? new Date(dto.contractEnd) : undefined,
        accessCode,
      },
    });
  }

  async findAccounts(propertyId: string) {
    const organizationId = await this.resolveOrganizationId(propertyId);
    return this.prisma.corporateAccount.findMany({
      where: { organizationId },
      include: { _count: { select: { ratePlans: true } } },
      orderBy: { companyName: 'asc' },
    });
  }

  async findAccountById(propertyId: string, accountId: string) {
    const organizationId = await this.resolveOrganizationId(propertyId);
    const account = await this.prisma.corporateAccount.findFirst({
      where: { id: accountId, organizationId },
      include: { ratePlans: { select: { id: true, code: true, name: true, propertyId: true, lastRoomAvailability: true } } },
    });
    if (!account) throw new NotFoundException(`Korporativni nalog ${accountId} nije pronađen.`);
    return account;
  }

  async updateAccount(propertyId: string, accountId: string, dto: UpdateCorporateAccountDto) {
    await this.findAccountById(propertyId, accountId);
    return this.prisma.corporateAccount.update({
      where: { id: accountId },
      data: {
        ...(dto.companyName && { companyName: dto.companyName }),
        ...(dto.contractStart !== undefined && { contractStart: new Date(dto.contractStart) }),
        ...(dto.contractEnd !== undefined && { contractEnd: new Date(dto.contractEnd) }),
      },
    });
  }
}
