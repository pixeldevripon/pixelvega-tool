import { Weekday } from '@prisma/client';

// Shared by ProjectReportService today, and the future Developer Report
// service described in docs/features/activity-reports/DESIGN.md. The team
// works six days a week at an eight hour a day goal.
export const WORKING_DAYS_PER_WEEK = 6;
export const TARGET_HOURS_PER_DAY = 8;

// The company default, and every User row's starting value (Weekday.FRIDAY on
// the Prisma schema). Read this ONLY where no specific person's own
// `weeklyOffDay` applies, e.g. an aggregate chart spanning a whole team with
// mixed off days. Any calculation for one person reads THEIR row instead, via
// WEEKDAY_TO_DAY_INDEX below, never this constant.
export const WEEKLY_OFF_DAY = 5;

// Bridges the Weekday enum stored on User (Friday or Saturday, this team's
// only two weekend options) to the JS Date.getUTCDay()/Intl weekday index
// (0 = Sunday) that countWorkingDaysInRange and the notification scheduler's
// Dhaka-local weekday check both compare against.
export const WEEKDAY_TO_DAY_INDEX: Record<Weekday, number> = {
  [Weekday.FRIDAY]: 5,
  [Weekday.SATURDAY]: 6,
};

// Intl's short weekday name to the same numeric index, so a caller reading a
// locale-formatted "today" (the notification scheduler's Dhaka-local check)
// can land on WEEKDAY_TO_DAY_INDEX's numbers without a second, Weekday
// specific map of its own. Generic over every day, not just Friday/Saturday,
// because Intl can return any of the seven.
export const SHORT_WEEKDAY_TO_DAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};
