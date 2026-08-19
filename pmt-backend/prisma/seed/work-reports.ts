import type { PrismaClient } from '@prisma/client';
import { DailyWorkReportStatus } from '@prisma/client';
import { SEED_TODAY, VOLUME } from './config';
import { Rand, addDays, atUtcTime, isFriday, utcDateOnly } from './random';
import { ACCOMPLISHMENT_TEXTS, PLAN_TEXTS, REVIEW_COMMENTS } from './pools';
import type { SeededProject } from './projects';
import type { SeededUsers } from './users';

export type SeededWorkReports = {
  reportCount: number;
  entryCount: number;
};

export async function seedWorkReports(
  prisma: PrismaClient,
  rand: Rand,
  users: SeededUsers,
  projects: SeededProject[],
): Promise<SeededWorkReports> {
  // Which projects each person could report against on a given day, based on
  // when they joined and when they left.
  const userProjects = new Map<
    string,
    { projectId: string; from: Date; to: Date }[]
  >();
  const projectManagers = new Map<string, string[]>();

  for (const project of projects) {
    projectManagers.set(project.id, project.managerIds);
    const projectEnd = project.completedAt ?? SEED_TODAY;
    for (const member of project.members) {
      const to = member.leftAt ?? projectEnd;
      if (to.getTime() <= member.joinedAt.getTime()) continue;
      const list = userProjects.get(member.userId) ?? [];
      list.push({ projectId: project.id, from: member.joinedAt, to });
      userProjects.set(member.userId, list);
    }
  }

  const authorIds = users.workforce
    .map((user) => user.id)
    .filter((id) => (userProjects.get(id) ?? []).length > 0);

  const adminIds = users.adminSide.map((user) => user.id);
  const reportRows: any[] = [];
  const entryRows: any[] = [];

  // Annotated as number because VOLUME is a const object, which would
  // otherwise make dayOffset the literal type of workReportDays.
  for (
    let dayOffset: number = VOLUME.workReportDays;
    dayOffset >= 0;
    dayOffset--
  ) {
    const day = utcDateOnly(addDays(SEED_TODAY, -dayOffset));
    if (isFriday(day)) continue;

    const isToday = dayOffset === 0;

    // The test accounts always report, so those logins always have a plan and
    // a wrap up history to read.
    const eligibleAuthors = new Set(authorIds);
    const sampledAuthors = new Set(rand.sample(authorIds, 52));
    for (const id of [
      users.test.projectManager.id,
      users.test.developer.id,
      users.test.designer.id,
    ]) {
      if (eligibleAuthors.has(id)) sampledAuthors.add(id);
    }

    for (const authorId of sampledAuthors) {
      const eligible = (userProjects.get(authorId) ?? []).filter(
        (item) =>
          item.from.getTime() <= day.getTime() &&
          day.getTime() <= item.to.getTime(),
      );
      if (eligible.length === 0) continue;

      // Today's reports are mostly still waiting on a wrap up. Older days are
      // almost always finished. A wrap up can only be submitted once a plan
      // exists, so a report is never COMPLETED without a plan timestamp.
      const isCompleted = isToday ? rand.chance(0.35) : rand.chance(0.88);

      const planSubmittedAt = atUtcTime(day, 3, rand.int(0, 59)); // 9 AM Dhaka
      const wrapUpSubmittedAt = isCompleted
        ? atUtcTime(day, 13, rand.int(0, 59)) // 7 PM Dhaka
        : null;

      const reportId = rand.uuid();
      reportRows.push({
        id: reportId,
        userId: authorId,
        date: day, // UTC midnight, the same value toDateOnly() produces
        status: isCompleted
          ? DailyWorkReportStatus.COMPLETED
          : DailyWorkReportStatus.PLAN_SUBMITTED,
        planSubmittedAt,
        wrapUpSubmittedAt,
        // Slack message timestamps are left null. A stored ts would make the
        // app try to edit a message Slack has never seen.
        planFeedSlackTs: null,
        wrapUpFeedSlackTs: null,
        createdAt: planSubmittedAt,
        updatedAt: wrapUpSubmittedAt ?? planSubmittedAt,
      });

      const chosen = rand.sample(
        eligible,
        rand.int(1, Math.min(3, eligible.length)),
      );

      for (const [index, item] of chosen.entries()) {
        // A project can appear at wrap up without having been in the morning
        // plan, which is unplanned or urgent work. That entry has no plan.
        const planOnly = !isCompleted;
        const unplanned = isCompleted && index > 0 && rand.chance(0.2);

        const plan = unplanned ? null : rand.pick(PLAN_TEXTS);
        const accomplishments = planOnly
          ? null
          : rand.pick(ACCOMPLISHMENT_TEXTS);

        // Reviewing an entry is only possible once its report is finished, and
        // the reviewer must be a PM on that specific project.
        const managers = projectManagers.get(item.projectId) ?? [];
        const canReview = isCompleted && rand.chance(0.3);
        const reviewerPool = managers.length > 0 ? managers : adminIds;
        const reviewedById = canReview ? rand.pick(reviewerPool) : null;

        entryRows.push({
          id: rand.uuid(),
          dailyWorkReportId: reportId,
          projectId: item.projectId,
          plan,
          accomplishments,
          planProjectSlackTs: null,
          wrapUpProjectSlackTs: null,
          reviewedById,
          // The reviewer and the review time are always written together.
          reviewedAt: reviewedById ? atUtcTime(day, 15, rand.int(0, 59)) : null,
          reviewComment: reviewedById
            ? (rand.maybe(REVIEW_COMMENTS, 0.25) ?? null)
            : null,
          createdAt: planSubmittedAt,
          updatedAt: wrapUpSubmittedAt ?? planSubmittedAt,
        });
      }
    }
  }

  await prisma.dailyWorkReport.createMany({ data: reportRows });
  await prisma.dailyProjectEntry.createMany({ data: entryRows });

  return { reportCount: reportRows.length, entryCount: entryRows.length };
}
