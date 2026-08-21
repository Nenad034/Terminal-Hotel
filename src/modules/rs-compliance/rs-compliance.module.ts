import { Module } from '@nestjs/common';
import { RsComplianceController } from './rs-compliance.controller';
import { FiscalService } from './fiscal.service';
import { SefService } from './sef.service';
import { EturistaService } from './eturista.service';

@Module({
  controllers: [RsComplianceController],
  providers: [FiscalService, SefService, EturistaService],
  exports: [FiscalService],
})
export class RsComplianceModule {}
