import { Module } from '@nestjs/common';
import { MiceController } from './mice.controller';
import { MiceService } from './mice.service';

@Module({
  controllers: [MiceController],
  providers: [MiceService],
})
export class MiceModule {}
