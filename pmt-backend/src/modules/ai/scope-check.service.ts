import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationType, ProjectDocumentType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ClaudeService } from './claude.service';
import { buildDocumentContent } from './document-content.util';
import { NotificationsService } from '../notifications/notifications.service';

interface CheckScopeJobData {
  aiJobId: string;
}

interface ScopeCheckStructuredResult {
  verdict: 'IN_SCOPE' | 'OUT_OF_SCOPE' | 'UNCLEAR';
  confidence: number;
  reasoning: string;
  suggestedAdditionalHours: number;
}

// Claude's output_config.format.schema rejects "minimum"/"maximum" on a
// number property (a real API limitation found by testing this against a
// live call, not something documented up front), so the 0 to 1 and
// non-negative constraints are described in words instead, in both the
// property description and the system prompt above.
const SCOPE_CHECK_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['IN_SCOPE', 'OUT_OF_SCOPE', 'UNCLEAR'] },
    confidence: {
      type: 'number',
      description: 'A number between 0 and 1.',
    },
    reasoning: { type: 'string' },
    suggestedAdditionalHours: {
      type: 'number',
      description: 'A non negative number, 0 or more.',
    },
  },
  required: ['verdict', 'confidence', 'reasoning', 'suggestedAdditionalHours'],
  additionalProperties: false,
};

const MODEL = 'claude-haiku-4-5';

// Handles CHECK_SCOPE jobs, dispatched into directly by AiJobsProcessor
// rather than being its own @Processor, see the note on that class for why.
// Lives here in src/modules/ai/, not src/modules/projects/ai/ as an earlier
// draft of docs/features/ai-integration/DESIGN.MD once suggested, since
// this needs nothing ProjectsModule specific, no ProjectActivityService,
// no ProjectMember write, only PrismaService (global) plus ClaudeService
// and buildDocumentContent, both already here. Keeping it here avoids a
// circular dependency between AiModule and ProjectsModule. NotificationsService
// is likewise safe to inject directly, it is @Global() and has no
// dependency back on either AiModule or ProjectsModule, see
// "The one AI dependent notification" in
// docs/features/notifications/DESIGN.md.
@Injectable()
export class ScopeCheckService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly claude: ClaudeService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handle(job: Job<CheckScopeJobData>): Promise<void> {
    const aiJob = await this.prisma.aiJob.findUniqueOrThrow({
      where: { id: job.data.aiJobId },
    });
    const { requirementId } = aiJob.input as { requirementId: string };
    const projectId = aiJob.projectId!;

    const requirement =
      await this.prisma.additionalRequirement.findUniqueOrThrow({
        where: { id: requirementId },
      });

    const documents = await this.prisma.projectDocument.findMany({
      where: {
        projectId,
        type: {
          in: [ProjectDocumentType.PRD, ProjectDocumentType.REQUIREMENT],
        },
        deletedAt: null,
      },
    });

    const contentBlocks = (
      await Promise.all(
        documents.map((document) => buildDocumentContent(document)),
      )
    ).filter((block) => block !== null);

    if (contentBlocks.length === 0) {
      await this.writeResult(requirementId, {
        verdict: null,
        confidence: null,
        reasoning:
          'No PRD or REQUIREMENT documents exist for this project yet, so there was nothing to compare this requirement against.',
        suggestedAdditionalHours: null,
        model: null,
      });
      return;
    }

    const { data, model } =
      await this.claude.generateStructured<ScopeCheckStructuredResult>({
        model: MODEL,
        system:
          "You are checking whether a newly reported project requirement is already covered by the project's existing PRD and requirement documents: in scope, out of scope, or unclear. Only use the information given in the attached documents, never invent requirements that are not present in the source material. suggestedAdditionalHours should be 0 when the requirement is already covered by the existing scope, or a rough, coarse estimate (like 2 or 6, not a precise figure) of extra hours it would add otherwise.",
        messages: [
          {
            role: 'user',
            content: [
              ...contentBlocks,
              {
                type: 'text',
                text: `New requirement to check:\n\n${requirement.description}`,
              },
            ],
          },
        ],
        schema: SCOPE_CHECK_SCHEMA,
        maxTokens: 512,
      });

    await this.writeResult(requirementId, { ...data, model });

    // No actor to exclude here, unlike most of this feature's other
    // notifications, whoever requested the check is not "performing" the
    // out of scope determination, Claude is, so every managing PM/Admin
    // gets notified, including whoever triggered the check themselves.
    if (data.verdict === 'OUT_OF_SCOPE') {
      const recipientIds =
        await this.notificationsService.resolveManagingPmAndAdminIds(projectId);
      await Promise.all(
        recipientIds.map((recipientId) =>
          this.notificationsService.notify({
            userId: recipientId,
            type: NotificationType.ADDITIONAL_REQUIREMENT_FLAGGED_OUT_OF_SCOPE,
            title: 'An additional requirement was flagged out of scope by AI',
            message: requirement.description,
            metadata: { projectId, additionalRequirementId: requirementId },
          }),
        ),
      );
    }
  }

  private async writeResult(
    requirementId: string,
    result: {
      verdict: string | null;
      confidence: number | null;
      reasoning: string;
      suggestedAdditionalHours: number | null;
      model: string | null;
    },
  ): Promise<void> {
    await this.prisma.additionalRequirement.update({
      where: { id: requirementId },
      data: {
        aiScopeAnalysis: {
          verdict: result.verdict,
          confidence: result.confidence,
          reasoning: result.reasoning,
          suggestedAdditionalHours: result.suggestedAdditionalHours,
          model: result.model,
          checkedAt: new Date().toISOString(),
        },
      },
    });
  }
}
