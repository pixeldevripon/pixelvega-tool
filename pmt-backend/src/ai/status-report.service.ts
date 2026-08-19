import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  AiTemplateKind,
  ProjectActivityType,
  ProjectDocumentType,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ClaudeService } from './claude.service';
import { AiTemplatesService } from './ai-templates.service';
import { buildDocumentContent } from './document-content.util';

interface GenerateStatusReportJobData {
  aiJobId: string;
}

interface StatusReportJobInput {
  periodStart: string;
  periodEnd: string;
  reportSnapshot: Record<string, unknown>;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MODEL = 'claude-haiku-4-5';

const DEFAULT_SYSTEM_PROMPT =
  'Write a project status report in markdown, based only on the information given. Never state a fact you were not given.';

// Handles GENERATE_STATUS_REPORT jobs, dispatched into directly by
// AiJobsProcessor, the same shared queue pattern ScopeCheckService already
// uses, see the note on that class for why. Lives here in src/modules/ai/,
// not ProjectsModule, for the same circular dependency reason: this handler
// needs nothing ProjectsModule specific. ProjectReportService's numbers
// were already computed once by ProjectStatusReportsService (in
// ProjectsModule, where the PM staffing check and access control also
// live) at enqueue time and travel here as a plain JSON snapshot on
// AiJob.input, so this handler never needs to inject ProjectReportService
// directly, avoiding an AiModule to ProjectsModule dependency the same way
// Feature 1's scope checker avoids one.
@Injectable()
export class StatusReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly claude: ClaudeService,
    private readonly aiTemplates: AiTemplatesService,
  ) {}

  async handle(job: Job<GenerateStatusReportJobData>): Promise<void> {
    const aiJob = await this.prisma.aiJob.findUniqueOrThrow({
      where: { id: job.data.aiJobId },
    });
    const { periodStart, periodEnd, reportSnapshot } =
      aiJob.input as unknown as StatusReportJobInput;
    const projectId = aiJob.projectId!;
    const requestedById = aiJob.requestedById!;

    const periodStartDate = new Date(periodStart);
    const periodEndDate = new Date(periodEnd);
    const periodEndExclusive = new Date(periodEndDate.getTime() + MS_PER_DAY);

    const [prd, entries, template] = await Promise.all([
      this.prisma.projectDocument.findFirst({
        where: { projectId, type: ProjectDocumentType.PRD, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
      // Unlike the project summary (Feature 2), which deliberately excludes
      // plan, both plan and accomplishments are useful here, planned versus
      // delivered side by side is the point of a status report.
      this.prisma.dailyProjectEntry.findMany({
        where: {
          projectId,
          dailyWorkReport: {
            date: { gte: periodStartDate, lt: periodEndExclusive },
          },
          OR: [{ plan: { not: null } }, { accomplishments: { not: null } }],
        },
        select: {
          plan: true,
          accomplishments: true,
          dailyWorkReport: {
            select: { date: true, user: { select: { name: true } } },
          },
        },
        orderBy: { dailyWorkReport: { date: 'asc' } },
      }),
      this.aiTemplates.findDefault(AiTemplateKind.STATUS_REPORT),
    ]);

    const prdContentBlock = prd ? await buildDocumentContent(prd) : null;

    const entriesText =
      entries.length === 0
        ? 'No plans or accomplishments have been logged for this period yet.'
        : entries
            .map((entry) => {
              const date = entry.dailyWorkReport.date
                .toISOString()
                .slice(0, 10);
              const parts: string[] = [];
              if (entry.plan) parts.push(`planned: ${entry.plan}`);
              if (entry.accomplishments) {
                parts.push(`accomplished: ${entry.accomplishments}`);
              }
              return `${date}, ${entry.dailyWorkReport.user.name}: ${parts.join('; ')}`;
            })
            .join('\n');

    const { text, model } = await this.claude.generateText({
      model: MODEL,
      system: template ? template.content : DEFAULT_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            ...(prdContentBlock ? [prdContentBlock] : []),
            {
              type: 'text',
              text: `Project numbers for ${periodStart} to ${periodEnd}:\n${JSON.stringify(reportSnapshot)}\n\nDaily plans and accomplishments for the same period:\n${entriesText}`,
            },
          ],
        },
      ],
      maxTokens: 2048,
    });

    const statusReport = await this.prisma.projectStatusReport.create({
      data: {
        projectId,
        requestedById,
        content: text,
        periodStart: periodStartDate,
        periodEnd: periodEndDate,
        model,
        templateId: template?.id ?? null,
      },
    });

    await this.prisma.aiJob.update({
      where: { id: aiJob.id },
      data: { resultRefId: statusReport.id },
    });

    // Written directly rather than through ProjectActivityService: a plain
    // one line Prisma create with no side effects, ProjectActivityService
    // lives in ProjectsModule and injecting it here would be the same
    // circular dependency this file's own note above already avoids.
    await this.prisma.projectActivity.create({
      data: {
        projectId,
        userId: requestedById,
        type: ProjectActivityType.AI_STATUS_REPORT_GENERATED,
        message: `AI status report generated for ${periodStart} to ${periodEnd}`,
        metadata: { statusReportId: statusReport.id },
      },
    });
  }
}
