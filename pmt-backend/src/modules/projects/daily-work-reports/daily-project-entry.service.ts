import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DailyWorkReportStatus,
  NotificationType,
  ProjectRole,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProjectActivityService } from '../project-activity.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ReviewEntryDto } from './dto/review-entry.dto';

const ENTRY_INCLUDE = {
  project: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true, email: true } },
  dailyWorkReport: { select: { id: true, userId: true, status: true } },
};

@Injectable()
export class DailyProjectEntryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectActivity: ProjectActivityService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async review(
    entryId: string,
    dto: ReviewEntryDto,
    actorId: string,
    actorRole: Role,
  ) {
    const entry = await this.prisma.dailyProjectEntry.findUnique({
      where: { id: entryId },
      include: ENTRY_INCLUDE,
    });
    if (!entry) {
      throw new NotFoundException('Daily project entry not found');
    }

    if (entry.dailyWorkReport.status !== DailyWorkReportStatus.COMPLETED) {
      throw new ConflictException(
        'Cannot review an entry before its wrap-up has been submitted',
      );
    }

    await this.assertCanReview(entry.projectId, actorId, actorRole);

    const updated = await this.prisma.dailyProjectEntry.update({
      where: { id: entryId },
      data: {
        reviewedById: actorId,
        reviewedAt: new Date(),
        reviewComment: dto.reviewComment,
      },
      include: ENTRY_INCLUDE,
    });

    await this.projectActivity.log(
      entry.projectId,
      actorId,
      'WORK_REPORT_REVIEWED',
      {
        message: 'Daily work report entry reviewed',
        metadata: { dailyProjectEntryId: entryId },
      },
    );

    // Only when an actual comment was left, a plain "reviewed, no comment"
    // has nothing to notify the developer about.
    if (dto.reviewComment && entry.dailyWorkReport.userId !== actorId) {
      await this.notificationsService.notify({
        userId: entry.dailyWorkReport.userId,
        type: NotificationType.WORK_REPORT_COMMENTED,
        title: `Your entry on ${entry.project.name} was commented on`,
        message: dto.reviewComment,
        metadata: { projectId: entry.projectId, dailyProjectEntryId: entryId },
      });
    }

    return updated;
  }

  private async assertCanReview(
    projectId: string,
    actorId: string,
    actorRole: Role,
  ) {
    if (actorRole === Role.ADMIN || actorRole === Role.SYSTEM_ADMIN) {
      return;
    }
    const membership = await this.prisma.projectMember.findFirst({
      where: {
        projectId,
        userId: actorId,
        role: ProjectRole.PROJECT_MANAGER,
        leftAt: null,
      },
    });
    if (!membership) {
      throw new ForbiddenException('You do not manage this project');
    }
  }
}
