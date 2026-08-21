import { Module } from '@nestjs/common';
import { HaccpController } from './haccp.controller';
import { HaccpService } from './haccp.service';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { CorrectiveActionsService } from './corrective-actions.service';

@Module({
  controllers: [HaccpController, IncidentsController],
  providers: [HaccpService, IncidentsService, CorrectiveActionsService],
})
export class ComplianceModule {}
