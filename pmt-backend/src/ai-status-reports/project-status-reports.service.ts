import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AiJobType, Prisma, ProjectRole, Role } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AiJobsService } from '@/ai/ai-jobs.service';
import { ProjectReportService } from '@/project-reports/project-report.service';
import { CreateStatusReportDto } from '@/ai-status-reports/dto/create-status-report.dto';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_PERIOD_DAYS = 7;

// Feature 3 from docs/features/ai-integration/DESIGN.MD. Enqueue and read
// live here in ProjectsModule, same as AdditionalRequirementsService's
// checkScope() for Feature 1, since the PM staffing check and
// ProjectReportService both belong here. The actual Claude call and
// ProjectStatusReport write happen in AiModule's StatusReportService
// instead, dispatched into by the shared AiJobsProcessor, see the note
// there for why the numeric side is computed once here at enqueue time
// rather than inside that handler.
@Injectable()
export class ProjectStatusReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiJobsService: AiJobsService,
    private readonly projectReport: ProjectReportService,
  ) {}

  async create(
    projectId: string,
    dto: CreateStatusReportDto,
    actorId: string,
    actorRole: Role,
  ) {
    await this.getProjectOrThrow(projectId);
    await this.assertManagesProject(projectId, actorId, actorRole);

    const { periodStart, periodEnd } = await this.resolvePeriod(projectId, dto);

    const reportSnapshot = await this.projectReport.getProjectReport(
      projectId,
      actorId,
      actorRole,
      { startDate: periodStart, endDate: periodEnd },
    );

    const job = await this.aiJobsService.enqueue(
      AiJobType.GENERATE_STATUS_REPORT,
      {
        projectId,
        requestedById: actorId,
        // A plain JSON snapshot, not the live object getProjectReport()
        // returned, round tripped through JSON so Date fields become
        // strings the same way they will read back once stored, avoiding
        // any ambiguity about what the job handler actually receives.
        input: JSON.parse(
          JSON.stringify({ periodStart, periodEnd, reportSnapshot }),
        ) as Prisma.InputJsonValue,
      },
    );
    return { jobId: job.id };
  }

  async findAll(projectId: string, actorId: string, actorRole: Role) {
    await this.getProjectOrThrow(projectId);
    await this.assertCanRead(projectId, actorId, actorRole);

    return this.prisma.projectStatusReport.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async resolvePeriod(projectId: string, dto: CreateStatusReportDto) {
    const periodEnd = dto.periodEnd ?? new Date().toISOString().slice(0, 10);

    if (dto.periodStart) {
      return { periodStart: dto.periodStart, periodEnd };
    }

    const lastReport = await this.prisma.projectStatusReport.findFirst({
      where: { projectId },
      orderBy: { periodEnd: 'desc' },
      select: { periodEnd: true },
    });

    const defaultPeriodStart = lastReport
      ? new Date(lastReport.periodEnd.getTime() + MS_PER_DAY)
          .toISOString()
          .slice(0, 10)
      : new Date(Date.now() - DEFAULT_PERIOD_DAYS * MS_PER_DAY)
          .toISOString()
          .slice(0, 10);

    // The day right after the last report's periodEnd can land after
    // periodEnd itself, e.g. a report already covering through today,
    // called again with no explicit period the same day. An inverted range
    // stored on the row would be nonsensical, ISO date strings compare
    // correctly as plain strings, so clamp down to a single day instead.
    const periodStart =
      defaultPeriodStart > periodEnd ? periodEnd : defaultPeriodStart;

    return { periodStart, periodEnd };
  }

  private async getProjectOrThrow(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  private async assertManagesProject(
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

  // Same read scoping as GET /projects/:projectId/ai/summary. CLIENT never
  // reaches here, excluded at the controller's @Roles level.
  private async assertCanRead(
    projectId: string,
    actorId: string,
    actorRole: Role,
  ) {
    if (actorRole !== Role.DEVELOPER && actorRole !== Role.DESIGNER) {
      return;
    }
    const membership = await this.prisma.projectMember.findFirst({
      where: { projectId, userId: actorId, leftAt: null },
    });
    if (!membership) {
      throw new ForbiddenException(
        'You are not an active member of this project',
      );
    }
  }
}
