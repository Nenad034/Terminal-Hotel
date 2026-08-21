import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateGuestDto, UpdateGuestDto, GuestSearchDto } from './dto/guest.dto';

@Injectable()
export class GuestsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Kreira novog gosta ili vraća postojećeg ako email već postoji
   * (dedup na nivou organizacije — GuestProfile je organization-scoped).
   */
  async createOrFindGuest(organizationId: string, dto: CreateGuestDto) {
    // Dedup pretraga po emailu unutar organizacije
    if (dto.email) {
      const existing = await this.prisma.guestProfile.findFirst({
        where: {
          organizationId,
          email: dto.email,
          gdprDeletedAt: null,
        },
      });
      if (existing) {
        return { ...existing, _deduplicated: true };
      }
    }

    const guest = await this.prisma.guestProfile.create({
      data: {
        organizationId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        idDocumentType: dto.idDocumentType,
        idDocumentNumber: dto.idDocumentNumber,
        nationality: dto.nationality,
        marketingConsent: dto.marketingConsent ?? false,
        consentRecordedAt: dto.marketingConsent ? new Date() : null,
        preferences: dto.preferences ?? {},
      },
    });

    return { ...guest, _deduplicated: false };
  }

  async findGuestById(organizationId: string, guestId: string) {
    const guest = await this.prisma.guestProfile.findFirst({
      where: { id: guestId, organizationId, gdprDeletedAt: null },
      include: {
        reservations: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            confirmationNumber: true,
            status: true,
            checkIn: true,
            checkOut: true,
          },
        },
        loyaltyTransactions: {
          orderBy: { earnedAt: 'desc' },
          take: 5,
        },
      },
    });
    if (!guest) throw new NotFoundException(`Gost ${guestId} nije pronađen.`);
    return guest;
  }

  async searchGuests(organizationId: string, search: GuestSearchDto) {
    return this.prisma.guestProfile.findMany({
      where: {
        organizationId,
        gdprDeletedAt: null,
        ...(search.lastName && {
          lastName: { contains: search.lastName, mode: 'insensitive' },
        }),
        ...(search.email && { email: search.email }),
        ...(search.phone && { phone: { contains: search.phone } }),
        ...(search.loyaltyNumber && { loyaltyNumber: search.loyaltyNumber }),
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 50,
    });
  }

  async updateGuest(organizationId: string, guestId: string, dto: UpdateGuestDto) {
    await this.findGuestById(organizationId, guestId);

    return this.prisma.guestProfile.update({
      where: { id: guestId },
      data: {
        ...dto,
        ...(dto.marketingConsent !== undefined && {
          consentRecordedAt: dto.marketingConsent ? new Date() : null,
        }),
      },
    });
  }

  /**
   * GDPR pravo na brisanje — anonimizacija PII podataka.
   * Ne briše fizički zapis (folio istorija mora ostati za poreske svrhe).
   * Postavlja gdpr_deleted_at marker i briše PII polja.
   */
  async gdprDeleteGuest(organizationId: string, guestId: string) {
    const guest = await this.findGuestById(organizationId, guestId);

    if (guest.gdprDeletedAt) {
      throw new ConflictException('Gost je već anonimizovan (GDPR brisanje).');
    }

    // Proveri da nema aktivnih rezervacija
    const activeReservations = await this.prisma.reservation.count({
      where: {
        primaryGuestId: guestId,
        status: { in: ['booked', 'confirmed', 'checked_in', 'held'] },
      },
    });

    if (activeReservations > 0) {
      throw new ConflictException(
        `Ne može se izvršiti GDPR brisanje — gost ima ${activeReservations} aktivnih rezervacija.`,
      );
    }

    const anonymized = await this.prisma.guestProfile.update({
      where: { id: guestId },
      data: {
        firstName: '[GDPR]',
        lastName: '[OBRISANO]',
        email: null,
        phone: null,
        idDocumentType: null,
        idDocumentNumber: null,
        nationality: null,
        preferences: {},
        marketingConsent: false,
        gdprDeletedAt: new Date(),
      },
    });

    return {
      id: anonymized.id,
      gdprDeletedAt: anonymized.gdprDeletedAt,
      message: 'PII podaci gosta su anonimizovani u skladu sa GDPR.',
    };
  }

  async getGuestStayHistory(organizationId: string, guestId: string) {
    await this.findGuestById(organizationId, guestId);

    return this.prisma.reservation.findMany({
      where: {
        primaryGuestId: guestId,
        status: { in: ['checked_out', 'cancelled', 'no_show'] },
      },
      include: {
        property: { select: { name: true } },
        roomType: { select: { code: true, name: true } },
        room: { select: { roomNumber: true } },
      },
      orderBy: { checkIn: 'desc' },
    });
  }
}
