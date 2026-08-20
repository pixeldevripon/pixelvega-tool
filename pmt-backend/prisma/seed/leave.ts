import type { PrismaClient } from '@prisma/client';
import { LeaveStatus } from '@prisma/client';
import { SEED_TODAY, VOLUME } from './config';
import { Rand, addDays, daysBetweenInclusive } from './random';
import { LEAVE_REASONS, LEAVE_TYPE_CORE } from './pools';
import type { SeededReference } from './reference';
import type { SeededUsers } from './users';

export type SeededLeave = {
  requestCount: number;
  balanceCount: number;
};

// Leave requests are spread over these years, never within two days of a year
// boundary. The app computes a balance year with startDate.getFullYear(),
// which is the local year, while the dates themselves are stored at UTC
// midnight. Staying away from the edges means both readings agree, whatever
// timezone the seed runs in.
const SAFE_FIRST_DAY_OF_YEAR = 3;
const SAFE_LAST_DAY_OF_YEAR = 355;

export async function seedLeave(
  prisma: PrismaClient,
  rand: Rand,
  users: SeededUsers,
  reference: SeededReference,
): Promise<SeededLeave> {
  // Only PM, developer, and designer submit leave. Admin and system admin
  // review it instead, they cannot request it themselves.
  const requesters = users.workforce;
  const reviewers = users.adminSide;

  // Requests mostly use the leave types a real company actually uses. The
  // long tail of generated types stays mostly empty, which is realistic.
  const coreNames = new Set(LEAVE_TYPE_CORE.map((type) => type.name));
  const coreTypes = reference.leaveTypes.filter((type) =>
    coreNames.has(type.name),
  );
  const generatedTypes = reference.leaveTypes.filter(
    (type) => !coreNames.has(type.name),
  );
  // At the seeded volume there is no long tail: VOLUME.leaveTypes is the core
  // list exactly, so this falls back to it. Without the fallback the 15% draw
  // below would pick from an empty array and read `id` off undefined.
  const otherTypes = generatedTypes.length > 0 ? generatedTypes : coreTypes;

  const requestRows: any[] = [];
  // usedDays per (user, leaveType, year), built as approved rows are created
  // so the balances below can never disagree with the requests.
  const usedDays = new Map<string, number>();

  // Everyone gets at least one request, then the rest are spread at random.
  // Without the first pass some staff accounts end up with an empty leave
  // history, which makes them useless for testing the leave endpoints.
  const assignments = [
    ...requesters,
    ...Array.from(
      { length: Math.max(0, VOLUME.leaveRequests - requesters.length) },
      () => rand.pick(requesters),
    ),
  ];

  for (const user of assignments) {
    const leaveType = rand.chance(0.85)
      ? rand.pick(coreTypes)
      : rand.pick(otherTypes);
    const year = rand.pick(VOLUME.leaveBalanceYears);

    const dayOfYear = rand.int(SAFE_FIRST_DAY_OF_YEAR, SAFE_LAST_DAY_OF_YEAR);
    const startDate = new Date(Date.UTC(year, 0, dayOfYear));
    const endDate = addDays(startDate, rand.int(0, 4));
    const days = daysBetweenInclusive(startDate, endDate);

    const createdAt = addDays(startDate, -rand.int(1, 21));

    // A request in the future is usually still pending. A past one has almost
    // always been decided by now.
    const isFuture = startDate.getTime() > SEED_TODAY.getTime();
    const roll = rand.float();
    let status: LeaveStatus;
    if (isFuture) {
      status =
        roll < 0.5
          ? LeaveStatus.PENDING
          : roll < 0.85
            ? LeaveStatus.APPROVED
            : LeaveStatus.CANCELLED;
    } else {
      status =
        roll < 0.68
          ? LeaveStatus.APPROVED
          : roll < 0.85
            ? LeaveStatus.REJECTED
            : roll < 0.94
              ? LeaveStatus.CANCELLED
              : LeaveStatus.PENDING;
    }

    // Only approving or rejecting records a reviewer. Cancelling is done by
    // the requester and leaves the reviewer fields alone.
    const isReviewed =
      status === LeaveStatus.APPROVED || status === LeaveStatus.REJECTED;
    const reviewedAt = isReviewed
      ? rand.dateBetween(createdAt, startDate)
      : null;

    if (status === LeaveStatus.APPROVED) {
      const key = `${user.id}|${leaveType.id}|${startDate.getFullYear()}`;
      usedDays.set(key, (usedDays.get(key) ?? 0) + days);
    }

    requestRows.push({
      id: rand.uuid(),
      userId: user.id,
      leaveTypeId: leaveType.id,
      startDate,
      endDate,
      days,
      reason: rand.pick(LEAVE_REASONS),
      status,
      reviewedById: isReviewed ? rand.pick(reviewers).id : null,
      reviewedAt,
      createdAt,
      updatedAt: reviewedAt ?? createdAt,
    });
  }

  await prisma.leaveRequest.createMany({ data: requestRows });

  // Balances. One row per user, leave type, and year, seeded from the type's
  // default allocation. usedDays comes straight from the approved requests
  // above, which is exactly what the app's own approve() would have produced.
  const balanceRows: any[] = [];
  const seen = new Set<string>();

  function addBalance(
    userId: string,
    leaveType: { id: string; defaultDaysPerYear: number },
    year: number,
  ) {
    const key = `${userId}|${leaveType.id}|${year}`;
    if (seen.has(key)) return;
    seen.add(key);
    const createdAt = new Date(Date.UTC(year, 0, 2));
    balanceRows.push({
      id: rand.uuid(),
      userId,
      leaveTypeId: leaveType.id,
      year,
      allocatedDays: leaveType.defaultDaysPerYear,
      usedDays: usedDays.get(key) ?? 0,
      createdAt,
      updatedAt: createdAt,
    });
  }

  // Every approved request needs its matching balance row, otherwise the
  // balance endpoint would report zero used days against a real approval.
  for (const key of usedDays.keys()) {
    const [userId, leaveTypeId, yearText] = key.split('|');
    const leaveType = reference.leaveTypes.find(
      (type) => type.id === leaveTypeId,
    );
    if (leaveType) addBalance(userId, leaveType, Number(yearText));
  }

  // Then fill in the common leave types for everyone, so a fresh employee
  // still has a full balance sheet to look at.
  for (const user of users.workforce) {
    for (const year of VOLUME.leaveBalanceYears) {
      for (const leaveType of rand.sample(
        coreTypes,
        VOLUME.leaveBalanceTypesPerUser,
      )) {
        addBalance(user.id, leaveType, year);
      }
    }
  }

  await prisma.leaveBalance.createMany({ data: balanceRows });

  return { requestCount: requestRows.length, balanceCount: balanceRows.length };
}
