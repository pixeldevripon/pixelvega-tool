import type { PrismaClient } from '@prisma/client';
import {
  AiJobStatus,
  AiJobType,
  ProjectStatus,
  StatusReportType,
} from '@prisma/client';
import { SEED_TODAY, VOLUME } from './config';
import { Rand, addDays, addMinutes } from './random';
import type { SeededProject } from './projects';
import type { SeededReference } from './reference';
import type { SeededUsers } from './users';

export type SeededAi = {
  statusReportCount: number;
  jobCount: number;
};

const CLAUDE_MODEL = 'claude-haiku-4-5';

const JOB_ERRORS = [
  'Anthropic API returned a 529 overloaded response after three retries.',
  'The project has no PRD or requirement document to compare against.',
  'Could not fetch the document from Cloudinary, the request timed out.',
  'Claude returned text that was not valid JSON.',
  'Redis connection dropped while the job was running.',
];

export async function seedAi(
  prisma: PrismaClient,
  rand: Rand,
  users: SeededUsers,
  projects: SeededProject[],
  reference: SeededReference,
): Promise<SeededAi> {
  const statusReports = await seedStatusReports(
    prisma,
    rand,
    users,
    projects,
    reference,
  );
  const jobCount = await seedAiJobs(
    prisma,
    rand,
    users,
    projects,
    statusReports,
  );

  return { statusReportCount: statusReports.length, jobCount };
}

type SeededStatusReport = {
  id: string;
  projectId: string;
  requestedById: string;
  periodStart: Date;
  periodEnd: Date;
};

async function seedStatusReports(
  prisma: PrismaClient,
  rand: Rand,
  users: SeededUsers,
  projects: SeededProject[],
  reference: SeededReference,
): Promise<SeededStatusReport[]> {
  const rows: any[] = [];
  const reports: SeededStatusReport[] = [];
  const adminIds = users.adminSide.map((user) => user.id);

  // The default template is what a real generation would pick up. A few rows
  // point at a variant instead, and a couple have none at all, since the
  // column is nullable for the case where a kind has no current default.
  const defaultTemplate = reference.statusReportTemplates.find(
    (template) => template.isDefault,
  );
  const variantTemplates = reference.statusReportTemplates.filter(
    (template) => !template.isDefault,
  );

  for (const project of projects) {
    // Nothing to report on a project that has not started.
    if (project.status === ProjectStatus.PLANNING) continue;

    const requesters =
      project.managerIds.length > 0 ? project.managerIds : adminIds;
    const count = rand.intFrom(VOLUME.statusReportsPerProject);

    // Reports are append only and each covers the stretch since the last one,
    // so periods run forward and never overlap.
    let periodStart = addDays(project.createdAt, rand.int(3, 14));

    for (let i = 0; i < count; i++) {
      const periodEnd = addDays(periodStart, rand.int(7, 21));
      const cappedEnd =
        periodEnd.getTime() > SEED_TODAY.getTime() ? SEED_TODAY : periodEnd;
      if (cappedEnd.getTime() <= periodStart.getTime()) break;

      const id = rand.uuid();
      const requestedById = rand.pick(requesters);
      const templateId = rand.chance(0.75)
        ? (defaultTemplate?.id ?? null)
        : rand.chance(0.9)
          ? rand.pick(variantTemplates).id
          : null;

      rows.push({
        id,
        projectId: project.id,
        requestedById,
        reportType: StatusReportType.STATUS_UPDATE,
        content: buildReportMarkdown(rand, project, periodStart, cappedEnd),
        periodStart,
        periodEnd: cappedEnd,
        model: CLAUDE_MODEL,
        templateId,
        createdAt: addMinutes(cappedEnd, rand.int(10, 600)),
      });

      reports.push({
        id,
        projectId: project.id,
        requestedById,
        periodStart,
        periodEnd: cappedEnd,
      });

      periodStart = cappedEnd;
      if (periodStart.getTime() >= SEED_TODAY.getTime()) break;
    }
  }

  await prisma.projectStatusReport.createMany({ data: rows });
  return reports;
}

function buildReportMarkdown(
  rand: Rand,
  project: SeededProject,
  periodStart: Date,
  periodEnd: Date,
): string {
  const day = (date: Date) => date.toISOString().slice(0, 10);
  const delivered = rand.int(3, 9);
  const planned = delivered + rand.int(0, 3);

  return `## Executive Summary
${project.name} is currently ${project.status.toLowerCase().replace(/_/g, ' ')}. The team delivered ${delivered} of ${planned} planned items between ${day(periodStart)} and ${day(periodEnd)}.

## Progress This Period
The team worked through the agreed backlog for this stretch and kept the build on the planned track. Most of the effort went into the pages and components that were already scoped.

## Planned vs Delivered
Planned items: ${planned}. Delivered items: ${delivered}. The gap carried into the next period rather than being dropped.

## Hours and Budget
Estimated hours stand at ${project.estimatedHours ?? 'not set'}. Hours logged so far are tracked against the project and reviewed weekly.

## Blockers and Risks
${rand.chance(0.6) ? 'One open blocker is waiting on the client, which is the main risk to the current date.' : 'No open blockers are affecting the timeline right now.'}

## Next Period Plan
Continue with the remaining scoped work, close out the open items above, and prepare the next internal review.`;
}

async function seedAiJobs(
  prisma: PrismaClient,
  rand: Rand,
  users: SeededUsers,
  projects: SeededProject[],
  statusReports: SeededStatusReport[],
) {
  // Scope check jobs point at the requirement they analysed, so read the
  // requirement ids back rather than threading them through every seeder.
  const requirements = await prisma.additionalRequirement.findMany({
    select: { id: true, projectId: true },
  });
  const requirementsByProject = new Map<string, string[]>();
  for (const requirement of requirements) {
    const list = requirementsByProject.get(requirement.projectId) ?? [];
    list.push(requirement.id);
    requirementsByProject.set(requirement.projectId, list);
  }

  const reportsByProject = new Map<string, SeededStatusReport[]>();
  for (const report of statusReports) {
    const list = reportsByProject.get(report.projectId) ?? [];
    list.push(report);
    reportsByProject.set(report.projectId, list);
  }

  const adminIds = users.adminSide.map((user) => user.id);
  const rows: any[] = [];

  for (const project of projects) {
    const requesters =
      project.managerIds.length > 0 ? project.managerIds : adminIds;
    const count = rand.intFrom(VOLUME.aiJobsPerProject);

    for (let i = 0; i < count; i++) {
      const projectRequirements = requirementsByProject.get(project.id) ?? [];
      const projectReports = reportsByProject.get(project.id) ?? [];

      // Only queue the kind of job this project actually has a result for.
      const canCheckScope = projectRequirements.length > 0;
      const canReport = projectReports.length > 0;
      if (!canCheckScope && !canReport) continue;

      const type =
        canCheckScope && (!canReport || rand.chance(0.5))
          ? AiJobType.CHECK_SCOPE
          : AiJobType.GENERATE_STATUS_REPORT;

      const createdAt = rand.dateBetween(
        addDays(project.createdAt, 5),
        SEED_TODAY,
      );

      const roll = rand.float();
      const status =
        roll < 0.72
          ? AiJobStatus.COMPLETED
          : roll < 0.84
            ? AiJobStatus.FAILED
            : roll < 0.93
              ? AiJobStatus.QUEUED
              : AiJobStatus.PROCESSING;

      // A queued job has not started. A processing one has started but not
      // finished. Only a finished job has a result or an error.
      const startedAt =
        status === AiJobStatus.QUEUED
          ? null
          : addMinutes(createdAt, rand.int(1, 5));
      const finishedAt =
        status === AiJobStatus.COMPLETED || status === AiJobStatus.FAILED
          ? addMinutes(startedAt ?? createdAt, rand.int(1, 90))
          : null;

      let input: Record<string, unknown>;
      let resultRefId: string | null = null;

      if (type === AiJobType.CHECK_SCOPE) {
        const requirementId = rand.pick(projectRequirements);
        input = { requirementId, projectId: project.id };
        if (status === AiJobStatus.COMPLETED) resultRefId = requirementId;
      } else {
        const report = rand.pick(projectReports);
        input = {
          projectId: project.id,
          periodStart: report.periodStart.toISOString(),
          periodEnd: report.periodEnd.toISOString(),
          // The numeric report snapshot is computed at enqueue time and passed
          // through as plain JSON, so the handler never has to look it up.
          reportSnapshot: {
            estimatedHours: project.estimatedHours,
            status: project.status,
            openBlockers: rand.int(0, 4),
          },
        };
        if (status === AiJobStatus.COMPLETED) resultRefId = report.id;
      }

      rows.push({
        id: rand.uuid(),
        type,
        status,
        projectId: project.id,
        requestedById: rand.pick(requesters),
        input,
        resultRefId,
        errorMessage:
          status === AiJobStatus.FAILED ? rand.pick(JOB_ERRORS) : null,
        startedAt,
        finishedAt,
        createdAt,
      });
    }
  }

  await prisma.aiJob.createMany({ data: rows });
  return rows.length;
}
