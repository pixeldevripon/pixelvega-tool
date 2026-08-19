import { Injectable, Logger } from '@nestjs/common';
import { AiTemplateKind, ProjectDocumentType, Role } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ClaudeService } from '@/ai/claude/claude.service';
import { AiTemplatesService } from '@/ai/templates/ai-templates.service';
import { buildDocumentContent } from '@/ai/claude/document-content.util';
import { ProjectReportService } from '@/project-reports/project/project-report.service';
import {
  endOfRangeExclusive,
  toDateOnly,
} from '@/project-reports/working-day/working-day.util';
import { QueryProjectAiSummaryDto } from '@/ai/summary/dto/project-ai-summary.dto';

const MODEL = 'claude-haiku-4-5';

const DEFAULT_SYSTEM_PROMPT =
  "Summarize this project's status in plain prose, based only on the information given. Never state a fact you were not given.";

// Feature 2 from docs/features/ai-integration/DESIGN.MD. Lives inside
// ProjectsModule, not AiModule, because it needs ProjectReportService, which
// itself lives in ProjectsModule (see CLAUDE.md's "Module layout" note on
// why anything needing ProjectActivityService/ProjectMember checks stays
// there). AiModule depending back on ProjectsModule would be circular,
// AiModule only ever exports outward, the same reason ScopeCheckService
// stays inside AiModule instead of here. Synchronous, no queue, unlike the
// scope checker and the future AI status report, this is a single quick
// prose call, not something worth a background job.
@Injectable()
export class ProjectAiSummaryService {
  private readonly logger = new Logger(ProjectAiSummaryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectReport: ProjectReportService,
    private readonly claude: ClaudeService,
    private readonly aiTemplates: AiTemplatesService,
  ) {}

  async getSummary(
    projectId: string,
    actorId: string,
    actorRole: Role,
    query: QueryProjectAiSummaryDto,
  ) {
    // getProjectReport() already does the project-not-found check and the
    // same assertActiveMember() read scoping this endpoint needs (PM/Admin/
    // System Admin any project, staffed Developer/Designer only), reused
    // rather than duplicated. Its blockers.currentlyOpenCount and core
    // snapshot fields are exactly what the design doc asks this feature to
    // combine with the raw accomplishments text below.
    const report = await this.projectReport.getProjectReport(
      projectId,
      actorId,
      actorRole,
      { startDate: query.startDate, endDate: query.endDate },
    );

    const rangeStart = toDateOnly(new Date(query.startDate));
    const rangeEndExclusive = endOfRangeExclusive(new Date(query.endDate));

    const [prd, entries, template] = await Promise.all([
      this.prisma.projectDocument.findFirst({
        where: { projectId, type: ProjectDocumentType.PRD, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
      // Deliberately DailyProjectEntry.accomplishments only, never .plan, a
      // plan is stated intent and may never actually happen, see the design
      // doc's "Deliberately excludes DailyProjectEntry.plan" note.
      this.prisma.dailyProjectEntry.findMany({
        where: {
          projectId,
          accomplishments: { not: null },
          dailyWorkReport: {
            date: { gte: rangeStart, lt: rangeEndExclusive },
          },
        },
        select: {
          accomplishments: true,
          dailyWorkReport: {
            select: { date: true, user: { select: { name: true } } },
          },
        },
        orderBy: { dailyWorkReport: { date: 'asc' } },
      }),
      this.aiTemplates.findDefault(AiTemplateKind.PROJECT_SUMMARY),
    ]);

    const prdContentBlock = prd ? await buildDocumentContent(prd) : null;

    const accomplishmentsText =
      entries.length === 0
        ? 'No accomplishments have been logged for this date range yet.'
        : entries
            .map((entry) => {
              const date = entry.dailyWorkReport.date
                .toISOString()
                .slice(0, 10);
              return `${date}, ${entry.dailyWorkReport.user.name}: ${entry.accomplishments}`;
            })
            .join('\n');

    const snapshotText = JSON.stringify({
      status: report.status,
      priority: report.priority,
      estimatedHours: report.estimatedHours,
      actualHours: report.actualHours,
      remainingHours: report.remainingHours,
      deadline: report.deadline,
      currentlyOpenBlockers: report.blockers.currentlyOpenCount,
    });

    const { text } = await this.claude.generateText({
      model: MODEL,
      system: template ? template.content : DEFAULT_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            ...(prdContentBlock ? [prdContentBlock] : []),
            {
              type: 'text',
              text: `Project snapshot:\n${snapshotText}\n\nAccomplishments reported from ${query.startDate} to ${query.endDate}:\n${accomplishmentsText}`,
            },
          ],
        },
      ],
      maxTokens: 1024,
    });

    // The AI calls are the only ones that cost money per request, so an
    // operator needs to see that one happened and for which project.
    this.logger.log(
      `Generated an AI summary for project ${projectId} from ${entries.length} wrap up entries`,
    );
    return {
      summary: text,
      generatedAt: new Date().toISOString(),
      basedOn: {
        prdDocumentId: prd?.id ?? null,
        wrapUpEntryCount: entries.length,
        dateRange: { startDate: query.startDate, endDate: query.endDate },
      },
    };
  }
}
