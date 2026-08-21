import { Module } from '@nestjs/common';
import { WorkersService } from './workers.service';
import { WorkersController } from './workers.controller';
import { ReservationsModule } from '../reservations/reservations.module';
import { FoliosModule } from '../folios/folios.module';
import { CapacityModule } from '../capacity/capacity.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [ReservationsModule, FoliosModule, CapacityModule, FinanceModule],
  providers: [WorkersService],
  controllers: [WorkersController],
})
export class WorkersModule {}
