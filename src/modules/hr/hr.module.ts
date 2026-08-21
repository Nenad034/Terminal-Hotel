import { Module } from '@nestjs/common';
import { HrController } from './hr.controller';
import { ShiftsService } from './shifts.service';
import { TimeClockService } from './time-clock.service';
import { CertificationsService } from './certifications.service';

@Module({
  controllers: [HrController],
  providers: [ShiftsService, TimeClockService, CertificationsService],
})
export class HrModule {}
