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
import { PrismaService } from '@/prisma/prisma.service';
import { ProjectActivityService } from '@/projects/activity/project-activity.service';
import { ProjectScopeService } from '@/projects/scope/project-scope.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { ReviewEntryDto } from '@/projects/daily-work-reports/dto/daily-work-report.dto';
import { toDailyProjectEntryResponse } from '@/projects/daily-work-reports/daily-work-report.mapper';

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
    private readonly projectScope: ProjectScopeService,
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

    // `assertCanReview` above passed, so the caller manages this project.
    return toDailyProjectEntryResponse(updated, entry.dailyWorkReport.userId, {
      callerId: actorId,
      managedProjectIds: new Set([entry.projectId]),
    });
  }

  // Reviewing is a manager's act, which is exactly
  // ProjectScopeService.managesProject: the project's own PROJECT_MANAGER, plus
  // ADMIN and SYSTEM_ADMIN through that service's superset rule. This was a
  // private copy of it, and the `canReview` flag did not match it at all.
  private async assertCanReview(
    projectId: string,
    actorId: string,
    actorRole: Role,
  ) {
    await this.projectScope.assertManagesProject(projectId, actorId, actorRole);
  }
}
