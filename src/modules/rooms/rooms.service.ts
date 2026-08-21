import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateRoomTypeDto,
  CreateRoomDto,
  UpdateRoomStatusDto,
  RoomFilterDto,
} from './dto/room.dto';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Room Types ─────────────────────────────────────────────────────────────

  async createRoomType(propertyId: string, dto: CreateRoomTypeDto) {
    const existing = await this.prisma.roomType.findUnique({
      where: { propertyId_code: { propertyId, code: dto.code } },
    });
    if (existing) {
      throw new ConflictException(`Tip sobe sa kodom '${dto.code}' već postoji.`);
    }
    return this.prisma.roomType.create({
      data: {
        propertyId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        baseOccupancy: dto.baseOccupancy,
        maxOccupancy: dto.maxOccupancy,
        accessible: dto.accessible,
        amenities: dto.amenities ?? [],
      },
    });
  }

  async findRoomTypes(propertyId: string) {
    return this.prisma.roomType.findMany({
      where: { propertyId },
      include: {
        _count: { select: { rooms: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findRoomTypeById(propertyId: string, roomTypeId: string) {
    const rt = await this.prisma.roomType.findFirst({
      where: { id: roomTypeId, propertyId },
      include: { rooms: true },
    });
    if (!rt) throw new NotFoundException(`Tip sobe ${roomTypeId} nije pronađen.`);
    return rt;
  }

  // ─── Rooms ──────────────────────────────────────────────────────────────────

  async createRoom(propertyId: string, dto: CreateRoomDto) {
    // Verifikuj da tip sobe pripada ovom objektu
    await this.findRoomTypeById(propertyId, dto.roomTypeId);

    const existing = await this.prisma.room.findUnique({
      where: { propertyId_roomNumber: { propertyId, roomNumber: dto.roomNumber } },
    });
    if (existing) {
      throw new ConflictException(`Soba broj '${dto.roomNumber}' već postoji.`);
    }

    return this.prisma.room.create({
      data: {
        propertyId,
        roomNumber: dto.roomNumber,
        floor: dto.floor,
        roomTypeId: dto.roomTypeId,
      },
      include: { roomType: true },
    });
  }

  async findRooms(propertyId: string, filter: RoomFilterDto) {
    return this.prisma.room.findMany({
      where: {
        propertyId,
        ...(filter.cleanlinessStatus && { cleanlinessStatus: filter.cleanlinessStatus }),
        ...(filter.occupancyStatus && { occupancyStatus: filter.occupancyStatus }),
        ...(filter.floor && { floor: filter.floor }),
        ...(filter.roomTypeId && { roomTypeId: filter.roomTypeId }),
      },
      include: {
        roomType: { select: { code: true, name: true } },
        tasks: {
          where: { status: { in: ['open', 'in_progress'] } },
          select: { id: true, taskType: true, priority: true, title: true },
          take: 3,
        },
      },
      orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
    });
  }

  async findRoomById(propertyId: string, roomId: string) {
    const room = await this.prisma.room.findFirst({
      where: { id: roomId, propertyId },
      include: {
        roomType: true,
        statusEvents: { orderBy: { occurredAt: 'desc' }, take: 10 },
        tasks: { where: { status: { not: 'completed' } } },
      },
    });
    if (!room) throw new NotFoundException(`Soba ${roomId} nije pronađena.`);
    return room;
  }

  async updateRoomStatus(
    propertyId: string,
    roomId: string,
    dto: UpdateRoomStatusDto,
  ) {
    const room = await this.findRoomById(propertyId, roomId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedRoom = await tx.room.update({
        where: { id: roomId },
        data: {
          ...(dto.cleanlinessStatus && { cleanlinessStatus: dto.cleanlinessStatus }),
          ...(dto.occupancyStatus && { occupancyStatus: dto.occupancyStatus }),
          ...(dto.outOfOrder !== undefined && { outOfOrder: dto.outOfOrder }),
          ...(dto.outOfService !== undefined && { outOfService: dto.outOfService }),
        },
        include: { roomType: true },
      });

      // Upiši audit trag u room_status_event
      await tx.roomStatusEvent.create({
        data: {
          roomId,
          occupancyStatus: dto.occupancyStatus ?? room.occupancyStatus,
          cleanlinessStatus: dto.cleanlinessStatus ?? room.cleanlinessStatus,
          changedBy: dto.changedBy ?? null,
        },
      });

      // Housekeeping → CMMS lanac (pogl. 7): kvar prijavljen (outOfOrder
      // false→true) automatski otvara radni nalog održavanja.
      if (dto.outOfOrder === true && !room.outOfOrder) {
        await tx.task.create({
          data: {
            propertyId,
            roomId,
            taskType: 'maintenance',
            priority: 'high',
            title: `Kvar prijavljen — soba ${room.roomNumber}`,
            assignedTo: dto.changedBy ?? undefined,
          },
        });
      }

      return updatedRoom;
    });

    return updated;
  }

  // ─── Housekeeping Board ──────────────────────────────────────────────────────

  async getHousekeepingBoard(propertyId: string) {
    const rooms = await this.prisma.room.findMany({
      where: { propertyId },
      include: {
        roomType: { select: { code: true, name: true, accessible: true } },
        tasks: {
          where: {
            taskType: { in: ['housekeeping', 'maintenance'] },
            status: { in: ['open', 'in_progress'] },
          },
          select: { id: true, taskType: true, priority: true, title: true, assignedTo: true },
        },
      },
      orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
    });

    // Grupisanje po spratovima
    const byFloor: Record<string, typeof rooms> = {};
    for (const room of rooms) {
      const floor = room.floor ?? 'Nepoznat sprat';
      if (!byFloor[floor]) byFloor[floor] = [];
      byFloor[floor].push(room);
    }

    const summary = {
      total: rooms.length,
      dirty: rooms.filter((r) => r.cleanlinessStatus === 'dirty').length,
      clean: rooms.filter((r) => r.cleanlinessStatus === 'clean').length,
      inspected: rooms.filter((r) => r.cleanlinessStatus === 'inspected').length,
      pickup: rooms.filter((r) => r.cleanlinessStatus === 'pickup').length,
      outOfOrder: rooms.filter((r) => r.outOfOrder).length,
      outOfService: rooms.filter((r) => r.outOfService).length,
    };

    return { summary, floors: byFloor };
  }

  async getRoomStatusHistory(propertyId: string, roomId: string) {
    await this.findRoomById(propertyId, roomId);
    return this.prisma.roomStatusEvent.findMany({
      where: { roomId },
      orderBy: { occurredAt: 'desc' },
      take: 50,
    });
  }
}
