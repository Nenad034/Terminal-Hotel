import { Module } from '@nestjs/common';
import { WorkersService } from './workers.service';
import { WorkersController } from './workers.controller';
import { ReservationsModule } from '../reservations/reservations.module';
import { FoliosModule } from '../folios/folios.module';
import { CapacityModule } from '../capacity/capacity.module';

@Module({
  imports: [ReservationsModule, FoliosModule, CapacityModule],
  providers: [WorkersService],
  controllers: [WorkersController],
})
export class WorkersModule {}
