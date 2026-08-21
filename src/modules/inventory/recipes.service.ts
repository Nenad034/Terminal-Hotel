import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateRecipeDto } from './dto/inventory.dto';

@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}

  async createRecipe(propertyId: string, dto: CreateRecipeDto) {
    return this.prisma.recipe.create({
      data: {
        propertyId,
        name: dto.name,
        yieldQuantity: dto.yieldQuantity ?? 1,
        yieldUnit: dto.yieldUnit ?? 'portion',
        targetFoodCostPercent: dto.targetFoodCostPercent,
        ingredients: {
          create: dto.ingredients.map((i) => ({ itemId: i.itemId, quantity: i.quantity })),
        },
      },
      include: { ingredients: { include: { item: true } } },
    });
  }

  async findRecipes(propertyId: string) {
    return this.prisma.recipe.findMany({
      where: { propertyId },
      include: { _count: { select: { ingredients: true } } },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Food cost formula (pogl. 6) — izvedeno polje, nikad ručni unos:
   *   Cena porcije = Σ(cena sastojka × količina) / prinos
   *   Predložena cena jela = Cena porcije ÷ ciljani Food Cost %
   * Koristi trenutni InventoryItem.costPerUnit, pa se ponovnim pozivom ove
   * metode automatski dobija ažurna cena posle svakog novog Receipt-a (pogl. 6:
   * "Inventory servis emituje event pri promeni cene artikla, Recipe servis se
   * pretplaćuje" — u v1 modularnom monolitu ovo se postiže čitanjem uživo,
   * bez potrebe za event bus-om).
   */
  async getRecipeCost(propertyId: string, recipeId: string) {
    const recipe = await this.prisma.recipe.findFirst({
      where: { id: recipeId, propertyId },
      include: { ingredients: { include: { item: true } } },
    });
    if (!recipe) throw new NotFoundException(`Receptura ${recipeId} nije pronađena.`);

    const ingredientCosts = recipe.ingredients.map((ing) => {
      const unitCost = Number(ing.item.costPerUnit);
      const quantity = Number(ing.quantity);
      const cost = unitCost * quantity;
      return {
        itemId: ing.itemId,
        name: ing.item.name,
        unit: ing.item.unit,
        quantity,
        unitCost,
        cost: Math.round(cost * 10000) / 10000,
      };
    });

    const totalIngredientCost = ingredientCosts.reduce((sum, i) => sum + i.cost, 0);
    const yieldQuantity = Number(recipe.yieldQuantity);
    const costPerPortion = yieldQuantity > 0 ? totalIngredientCost / yieldQuantity : totalIngredientCost;

    const targetFoodCostPercent = recipe.targetFoodCostPercent ? Number(recipe.targetFoodCostPercent) : null;
    const suggestedPrice =
      targetFoodCostPercent && targetFoodCostPercent > 0 ? costPerPortion / targetFoodCostPercent : null;

    return {
      recipeId: recipe.id,
      name: recipe.name,
      yieldQuantity,
      yieldUnit: recipe.yieldUnit,
      ingredients: ingredientCosts,
      totalIngredientCost: Math.round(totalIngredientCost * 100) / 100,
      costPerPortion: Math.round(costPerPortion * 100) / 100,
      targetFoodCostPercent,
      suggestedPrice: suggestedPrice ? Math.round(suggestedPrice * 100) / 100 : null,
    };
  }
}
