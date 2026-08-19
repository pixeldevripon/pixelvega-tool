import { Module } from '@nestjs/common';
import { AiModule } from '@/ai/ai.module';
import { AdditionalRequirementsController } from '@/projects/requirements/additional/additional-requirements.controller';
import { AdditionalRequirementsService } from '@/projects/requirements/additional/additional-requirements.service';
import { ClientFeedbackController } from '@/projects/reviews/client/client-feedback.controller';
import { ClientFeedbackService } from '@/projects/reviews/client/client-feedback.service';
import { InternalReviewsController } from './internal-reviews.controller';
import { InternalReviewsService } from './internal-reviews.service';

/**
 * The three review gates a project passes through: an internal review before it
 * goes to the client, the client's own feedback, and the additional
 * requirements that arrive outside the original scope.
 *
 * Grouped because they are one workflow. Each remains in its own directory, so
 * the module reaches across three folders. AiModule is needed by
 * AdditionalRequirements, which enqueues the scope check.
 */
@Module({
  imports: [AiModule],
  controllers: [
    InternalReviewsController,
    ClientFeedbackController,
    AdditionalRequirementsController,
  ],
  providers: [
    InternalReviewsService,
    ClientFeedbackService,
    AdditionalRequirementsService,
  ],
})
export class ReviewsModule {}
