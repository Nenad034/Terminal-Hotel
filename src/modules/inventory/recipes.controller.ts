import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiParam } from '@nestjs/swagger';
import { RecipesService } from './recipes.service';
import { CreateRecipeDto } from './dto/inventory.dto';
import { PropertyId } from '../../common/decorators/tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Inventory / Procurement')
@ApiSecurity('property-context')
@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Post()
  @RequirePermissions('inventory:manage')
  @ApiOperation({ summary: 'Kreiraj recepturu (BOM)' })
  createRecipe(@PropertyId() propertyId: string, @Body() dto: CreateRecipeDto) {
    return this.recipesService.createRecipe(propertyId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista receptura' })
  findRecipes(@PropertyId() propertyId: string) {
    return this.recipesService.findRecipes(propertyId);
  }

  @Get(':id/cost')
  @ApiOperation({
    summary: 'Izračunaj cenu porcije i predloženu cenu jela',
    description:
      'Cena porcije = Σ(cena sastojka × količina) / prinos. Predložena cena = cena porcije ÷ ciljani food cost %. ' +
      'Uvek izvedeno iz trenutnog InventoryItem.costPerUnit — nikad ručno unet broj.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  getRecipeCost(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.recipesService.getRecipeCost(propertyId, id);
  }
}
