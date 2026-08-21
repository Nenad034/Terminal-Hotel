import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { ProcurementController } from './procurement.controller';
import { ProcurementService } from './procurement.service';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';

@Module({
  controllers: [InventoryController, ProcurementController, RecipesController],
  providers: [InventoryService, ProcurementService, RecipesService],
})
export class InventoryModule {}
