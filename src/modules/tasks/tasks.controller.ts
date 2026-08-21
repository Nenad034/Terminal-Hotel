import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiParam } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto, TaskFilterDto } from './dto/task.dto';
import { PropertyId } from '../../common/decorators/tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Tasks / CMMS')
@ApiSecurity('property-context')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @RequirePermissions('tasks:manage')
  @ApiOperation({
    summary: 'Kreiraj zadatak / radni nalog',
    description:
      'Zajednički backbone za housekeeping, održavanje (CMMS) i goste-inicirane zahteve — ' +
      'razlikuju se preko taskType polja, ne kroz odvojene modele.',
  })
  createTask(@PropertyId() propertyId: string, @Body() dto: CreateTaskDto) {
    return this.tasksService.createTask(propertyId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista zadataka (filteri: status, tip, soba, izvršilac, prioritet)' })
  findTasks(@PropertyId() propertyId: string, @Query() filter: TaskFilterDto) {
    return this.tasksService.findTasks(propertyId, filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalji zadatka' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  findTaskById(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.tasksService.findTaskById(propertyId, id);
  }

  @Patch(':id')
  @RequirePermissions('tasks:manage')
  @ApiOperation({
    summary: 'Ažuriraj zadatak — dodela, promena statusa/prioriteta',
    description:
      'Prelazak statusa u completed/cancelled automatski upisuje completedAt; ' +
      'ponovno otvaranje ga briše.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  updateTask(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.updateTask(propertyId, id, dto);
  }
}
