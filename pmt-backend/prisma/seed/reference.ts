import type { PrismaClient } from '@prisma/client';
import { AiTemplateKind } from '@prisma/client';
import { SEED_TODAY, VOLUME } from './config';
import { Rand, addDays } from './random';
import {
  BLOCKER_REASON_CORE,
  BLOCKER_REASON_EXTRA_TOPICS,
  HOLIDAY_TEMPLATES,
  LEAVE_TYPE_CORE,
  LEAVE_TYPE_EXTRA_PREFIXES,
} from './pools';
import type { SeededUsers } from './users';

export type SeededReference = {
  leaveTypes: { id: string; name: string; defaultDaysPerYear: number }[];
  blockerReasons: { id: string; name: string }[];
  /** The protected fallback row BlockerService assigns when no reason is given. */
  unspecifiedReasonId: string;
  statusReportTemplates: { id: string; isDefault: boolean }[];
};

const PROJECT_SUMMARY_OUTLINE = `## Where the project stands
## What moved this period
## Open blockers
## What is next`;

const STATUS_REPORT_OUTLINE = `## Executive Summary
## Progress This Period
## Planned vs Delivered
## Hours and Budget
## Blockers and Risks
## Next Period Plan`;

export async function seedReference(
  prisma: PrismaClient,
  rand: Rand,
  users: SeededUsers,
): Promise<SeededReference> {
  const leaveTypes = await seedLeaveTypes(prisma, rand);
  await seedHolidays(prisma, rand);
  const { blockerReasons, unspecifiedReasonId } = await seedBlockerReasons(
    prisma,
    rand,
  );
  const statusReportTemplates = await seedAiTemplates(prisma, rand, users);

  return {
    leaveTypes,
    blockerReasons,
    unspecifiedReasonId,
    statusReportTemplates,
  };
}

async function seedLeaveTypes(prisma: PrismaClient, rand: Rand) {
  const rows: {
    id: string;
    name: string;
    defaultDaysPerYear: number;
    createdAt: Date;
    updatedAt: Date;
  }[] = [];
  const taken = new Set<string>();

  const createdAt = addDays(SEED_TODAY, -520);

  for (const core of LEAVE_TYPE_CORE) {
    taken.add(core.name);
    rows.push({
      id: rand.uuid(),
      name: core.name,
      defaultDaysPerYear: core.defaultDaysPerYear,
      createdAt,
      updatedAt: createdAt,
    });
  }

  // The core list is what a real company uses. The rest exist only so this
  // table clears 100 rows, which makes the leave filters and the summary
  // report worth testing at scale.
  let index = 0;
  while (rows.length < VOLUME.leaveTypes) {
    const prefix =
      LEAVE_TYPE_EXTRA_PREFIXES[index % LEAVE_TYPE_EXTRA_PREFIXES.length];
    const round = Math.floor(index / LEAVE_TYPE_EXTRA_PREFIXES.length) + 1;
    const name = `${prefix} Leave Category ${round}`;
    index++;
    if (taken.has(name)) continue;
    taken.add(name);
    rows.push({
      id: rand.uuid(),
      name,
      defaultDaysPerYear: rand.int(2, 15),
      createdAt,
      updatedAt: createdAt,
    });
  }

  await prisma.leaveType.createMany({ data: rows });
  return rows.map(({ id, name, defaultDaysPerYear }) => ({
    id,
    name,
    defaultDaysPerYear,
  }));
}

async function seedHolidays(prisma: PrismaClient, rand: Rand) {
  const rows: any[] = [];
  const taken = new Set<string>();

  // The same calendar repeated per year. startDate and endDate model a range,
  // and they are equal for a single day holiday.
  for (const year of VOLUME.holidayYears) {
    for (const template of HOLIDAY_TEMPLATES) {
      const startDate = new Date(Date.UTC(year, template.month, template.day));
      const key = `${template.name}|${startDate.toISOString()}`;
      if (taken.has(key)) continue;
      taken.add(key);
      rows.push({
        id: rand.uuid(),
        name: template.name,
        startDate,
        endDate: addDays(startDate, template.span - 1),
        createdAt: new Date(Date.UTC(year - 1, 10, 1)),
        updatedAt: new Date(Date.UTC(year - 1, 10, 1)),
      });
    }
  }

  await prisma.holiday.createMany({ data: rows });
  return rows.length;
}

type BlockerReasonRow = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

async function seedBlockerReasons(prisma: PrismaClient, rand: Rand) {
  const rows: BlockerReasonRow[] = [];
  const taken = new Set<string>();
  const createdAt = addDays(SEED_TODAY, -400);

  for (const name of BLOCKER_REASON_CORE) {
    taken.add(name);
    rows.push({
      id: rand.uuid(),
      name,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    });
  }

  // Build the rest by pairing a topic with a failure mode. Name uniqueness is
  // a partial index over rows where deletedAt is null, so the soft deleted
  // ones below can safely reuse a name.
  const modes = ['blocked', 'failing', 'not configured', 'access pending'];
  let i = 0;
  while (rows.length < VOLUME.blockerReasons) {
    const topic =
      BLOCKER_REASON_EXTRA_TOPICS[i % BLOCKER_REASON_EXTRA_TOPICS.length];
    const mode =
      modes[Math.floor(i / BLOCKER_REASON_EXTRA_TOPICS.length) % modes.length];
    const name = `${topic} ${mode}`;
    i++;
    if (taken.has(name)) continue;
    taken.add(name);
    rows.push({
      id: rand.uuid(),
      name,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    });
  }

  await prisma.blockerReason.createMany({ data: rows });

  // Soft delete a handful, but never the protected fallback row. This gives
  // the picker something to hide while existing blockers still resolve their
  // reason on read.
  const deletable = rows.filter((row) => row.name !== 'Unspecified');
  for (const row of rand.sample(deletable, 8)) {
    await prisma.blockerReason.update({
      where: { id: row.id },
      data: {
        deletedAt: rand.dateBetween(addDays(SEED_TODAY, -120), SEED_TODAY),
      },
    });
  }

  const unspecified = rows.find((row) => row.name === 'Unspecified');
  if (!unspecified) {
    throw new Error('The Unspecified blocker reason must exist');
  }

  return {
    blockerReasons: rows.map(({ id, name }) => ({ id, name })),
    unspecifiedReasonId: unspecified.id,
  };
}

type AiTemplateRow = {
  id: string;
  kind: AiTemplateKind;
  name: string;
  content: string;
  isDefault: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

async function seedAiTemplates(
  prisma: PrismaClient,
  rand: Rand,
  users: SeededUsers,
) {
  const rows: AiTemplateRow[] = [];
  const createdAt = addDays(SEED_TODAY, -300);

  // Exactly one row per kind may have isDefault true. That is enforced by a
  // partial unique index, so the first of each kind is the default and every
  // later one is not.
  const kinds = [
    { kind: AiTemplateKind.PROJECT_SUMMARY, outline: PROJECT_SUMMARY_OUTLINE },
    { kind: AiTemplateKind.STATUS_REPORT, outline: STATUS_REPORT_OUTLINE },
  ];

  for (const { kind, outline } of kinds) {
    for (let i = 0; i < VOLUME.aiTemplatesPerKind; i++) {
      const isDefault = i === 0;
      const label = isDefault
        ? 'Standard'
        : `Variant ${i} for ${rand.pick(['client facing', 'leadership', 'internal', 'short form', 'detailed'])}`;
      rows.push({
        id: rand.uuid(),
        kind,
        name: `${kind === AiTemplateKind.PROJECT_SUMMARY ? 'Project Summary' : 'Status Report'} ${label}`,
        content: isDefault
          ? outline
          : `${outline}\n## Extra Notes for variant ${i}`,
        isDefault,
        createdById: rand.pick(users.adminSide).id,
        createdAt,
        updatedAt: createdAt,
      });
    }
  }

  await prisma.aiTemplate.createMany({ data: rows });

  return rows
    .filter((row) => row.kind === AiTemplateKind.STATUS_REPORT)
    .map((row) => ({ id: row.id, isDefault: row.isDefault }));
}
