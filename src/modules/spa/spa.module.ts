import { Module } from '@nestjs/common';
import { SpaController } from './spa.controller';
import { SpaService } from './spa.service';
import { FoliosModule } from '../folios/folios.module';

@Module({
  imports: [FoliosModule],
  controllers: [SpaController],
  providers: [SpaService],
})
export class SpaModule {}
