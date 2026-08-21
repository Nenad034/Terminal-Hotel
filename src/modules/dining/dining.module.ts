import { Module } from '@nestjs/common';
import { DiningController } from './dining.controller';
import { DiningService } from './dining.service';
import { FoliosModule } from '../folios/folios.module';

@Module({
  imports: [FoliosModule],
  controllers: [DiningController],
  providers: [DiningService],
})
export class DiningModule {}
