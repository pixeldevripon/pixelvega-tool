// Shared by ProjectReportService today, and the future Developer Report
// service described in docs/features/activity-reports/DESIGN.md. The team
// works six days a week at an eight hour a day goal.
export const WORKING_DAYS_PER_WEEK = 6;
export const TARGET_HOURS_PER_DAY = 8;

// Day of week index (0 = Sunday). Friday for this team, a one line
// constant to change if that is wrong. Was briefly set to 6 (Saturday) by
// mistake, mismatching this very comment, corrected back to 5 (Friday).
export const WEEKLY_OFF_DAY = 5;
