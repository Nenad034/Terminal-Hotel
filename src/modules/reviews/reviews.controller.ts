import { Controller, Post, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiParam } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { PropertyId } from '../../common/decorators/tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Reviews')
@ApiSecurity('property-context')
@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('reservations/:id/review-request')
  @RequirePermissions('reviews:manage')
  @ApiOperation({
    summary: 'Ručno okini zahtev za recenziju nakon checkout-a',
    description: 'Zahteva marketing_consent i status=checked_out; ne šalje duplikat za istu rezervaciju.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  requestReview(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.reviewsService.requestReviewForReservation(propertyId, id);
  }

  @Get('guests/:id/review-requests')
  @RequirePermissions('reviews:manage')
  @ApiOperation({ summary: 'Istorija poslatih zahteva za recenziju gosta' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  listReviewRequests(@Param('id') id: string) {
    return this.reviewsService.listReviewRequests(id);
  }

  @Post('reviews/run-auto')
  @RequirePermissions('reviews:manage')
  @ApiOperation({ summary: 'Ručno pokreni noćni auto-scan za review-request (za testiranje)' })
  runAuto() {
    return this.reviewsService.runAutoReviewRequestsManual();
  }
}
