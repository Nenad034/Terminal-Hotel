import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateTaskDto, UpdateTaskDto, TaskFilterDto } from './dto/task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async createTask(propertyId: string, dto: CreateTaskDto) {
    return this.prisma.task.create({
      data: {
        propertyId,
        taskType: dto.taskType,
        priority: dto.priority ?? 'normal',
        title: dto.title,
        description: dto.description,
        roomId: dto.roomId,
        reservationId: dto.reservationId,
        assignedTo: dto.assignedTo,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      },
      include: {
        room: { select: { roomNumber: true, floor: true } },
        assignee: { select: { firstName: true, lastName: true } },
      },
    });
  }

  async findTasks(propertyId: string, filter: TaskFilterDto) {
    return this.prisma.task.findMany({
      where: {
        propertyId,
        ...(filter.status && { status: filter.status }),
        ...(filter.taskType && { taskType: filter.taskType }),
        ...(filter.roomId && { roomId: filter.roomId }),
        ...(filter.assignedTo && { assignedTo: filter.assignedTo }),
        ...(filter.priority && { priority: filter.priority }),
      },
      include: {
        room: { select: { roomNumber: true, floor: true } },
        assignee: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findTaskById(propertyId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, propertyId },
      include: {
        room: { select: { roomNumber: true, floor: true } },
        assignee: { select: { firstName: true, lastName: true } },
      },
    });
    if (!task) throw new NotFoundException(`Zadatak ${taskId} nije pronađen.`);
    return task;
  }

  async updateTask(propertyId: string, taskId: string, dto: UpdateTaskDto) {
    const existing = await this.findTaskById(propertyId, taskId);

    const closing = dto.status === 'completed' || dto.status === 'cancelled';
    const reopening = dto.status && !closing && existing.status !== dto.status;

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...(dto.status && { status: dto.status }),
        ...(dto.priority && { priority: dto.priority }),
        ...(dto.assignedTo !== undefined && { assignedTo: dto.assignedTo }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.dueAt !== undefined && { dueAt: dto.dueAt ? new Date(dto.dueAt) : null }),
        ...(closing && { completedAt: new Date() }),
        ...(reopening && { completedAt: null }),
      },
      include: {
        room: { select: { roomNumber: true, floor: true } },
        assignee: { select: { firstName: true, lastName: true } },
      },
    });
  }
}
