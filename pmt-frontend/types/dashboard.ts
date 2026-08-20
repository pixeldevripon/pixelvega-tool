import type { EnumDisplay } from '@/contexts/role-context';

/**
 * `GET /dashboard`, mirrored from `pmt-backend/src/dashboard/dto/dashboard.dto.ts`.
 *
 * **Nothing in here is computed on this side.** Every figure, label, share, delta
 * and capability arrives already decided, because deciding any of them in a
 * browser means a second copy of a business rule (D4). If a screen needs a number
 * that is not on this type, the fix is a backend field, not a `reduce` in a
 * component.
 *
 * A `type` alias rather than an `interface` throughout: TanStack Table 9's
 * generic constraint is satisfied by the former and not the latter.
 */

export type DashboardAudience = 'ADMIN' | 'MANAGER' | 'STAFF' | 'CLIENT';

export type DashboardRange = {
  from: string;
  to: string;
  days: number;
  label: string;
};

export type DashboardSeriesPoint = {
  date: string;
  label: string;
  value: number;
  valueLabel: string;
  /** False on the team's weekly off day, so a zero can be read correctly. */
  isWorkingDay: boolean;
  /**
   * The busiest day, for a chart that emphasises it. True on at most one point,
   * and on none at all when the whole series is zero. Never scan for the
   * maximum here: two components breaking a tie differently would highlight
   * different bars on the same data.
   */
  isPeak: boolean;
};

export type DashboardSeries = {
  label: string;
  points: DashboardSeriesPoint[];
  totalValue: number;
  totalLabel: string;
  dailyTarget: number | null;
};

export type DashboardMetric = {
  key: string;
  label: string;
  caption: string | null;
  /** Exact. Hours are MINUTES here; `valueLabel` is the readable form. */
  value: number;
  valueLabel: string;
  previousValue: number | null;
  changeRate: number | null;
  changeLabel: string | null;
  /** Whether the movement is good or bad. Decided by the server. */
  tone: EnumDisplay;
};

export type DashboardSlice = {
  key: EnumDisplay;
  count: number;
  share: number;
  shareLabel: string;
};

export type DashboardBreakdown = {
  label: string;
  total: number;
  totalLabel: string;
  slices: DashboardSlice[];
};

export type DashboardRankedRow = {
  id: string;
  name: string;
  subtitle: string | null;
  avatarUrl: string | null;
  value: number;
  valueLabel: string;
  /** This row's share of the list total, for the bar behind it. */
  share: number;
  changeRate: number | null;
  changeLabel: string | null;
  tone: EnumDisplay;
};

export type DashboardRankedList = {
  label: string;
  caption: string;
  rows: DashboardRankedRow[];
};

export type DashboardMember = {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** Their role on THIS project, not their account role. */
  projectRole: EnumDisplay;
};

/**
 * What the caller may do to this project.
 *
 * Gate a card's controls from here, never from a role. A project manager sees
 * every project and manages only their own, so two cards on the same screen
 * legitimately disagree about `canManage`.
 */
export type DashboardProjectCapabilities = {
  canManage: boolean;
  canTrackTime: boolean;
  isMember: boolean;
};

export type DashboardProject = {
  id: string;
  name: string;
  status: EnumDisplay;
  priority: EnumDisplay;
  types: EnumDisplay[];
  deadline: string | null;
  daysUntilDeadline: number | null;
  deadlineLabel: string | null;
  isOverdue: boolean;
  /** Overdue or blocked. The one flag a card colours itself from. */
  isAtRisk: boolean;
  plannedStartDate: string | null;
  progressPercentage: number;
  estimatedHours: number | null;
  actualHours: number;
  /** Read these, not the floats above: an hours sum arrives as 56.0833333. */
  actualHoursLabel: string;
  estimatedHoursLabel: string | null;
  remainingHours: number | null;
  remainingHoursLabel: string | null;
  hoursUsedRate: number | null;
  isActive: boolean;
  openBlockerCount: number;
  highSeverityBlockerCount: number;
  minutesInRange: number;
  minutesInRangeLabel: string;
  lastWorkedAt: string | null;
  members: DashboardMember[];
  capabilities: DashboardProjectCapabilities;
};

/** The reduced projection a client receives: status and deadline, nothing else. */
export type DashboardClientProject = {
  id: string;
  name: string;
  status: EnumDisplay;
  deadline: string | null;
  deadlineLabel: string | null;
  isAwaitingMyFeedback: boolean;
};

export type DashboardHours = {
  minutes: number;
  hours: number;
  label: string;
};

export type DashboardCompliance = {
  submitted: number;
  expected: number;
  /** Null when nobody was expected, which is not the same as none submitting. */
  rate: number | null;
  rateLabel: string | null;
};

export type DashboardActiveTimer = {
  timeEntryId: string;
  projectId: string | null;
  projectName: string | null;
  startedAt: string;
  status: EnumDisplay;
  /** Count up from this rather than computing the total in the browser. */
  elapsedMinutes: number;
  elapsedLabel: string;
};

export type DashboardMyDay = {
  activeTimer: DashboardActiveTimer | null;
  today: DashboardHours;
  thisWeek: DashboardHours;
  weekTargetMinutes: number;
  weekTargetLabel: string;
  /**
   * This week against the target. **Not capped at 1**: over the target is a fact
   * worth showing. A bar clips it with `overflow-hidden` rather than a `Math.min`.
   * Null when the target is zero.
   */
  weekProgressRate: number | null;
  weekProgressLabel: string | null;
  myHoursTrend: DashboardSeries;
  todayWorkReportStatus: EnumDisplay | null;
  myOpenBlockerCount: number;
};

/**
 * One queue waiting on somebody.
 *
 * `key` is stable and never rendered: an icon and a link are keyed off it, the
 * same way a class is keyed off a tone. Everything a reader sees (the wording,
 * the number, the urgency) arrives decided.
 */
export type DashboardAttentionItem = {
  key: string;
  label: string;
  count: number;
  tone: EnumDisplay;
};

/**
 * The queues, already filtered and ordered.
 *
 * Empty queues and queues the caller may not act on are already gone, and the
 * two are deliberately indistinguishable here. Do not re-order: the fixed order
 * is what lets a reader learn where to look.
 */
export type DashboardAttention = {
  total: number;
  totalLabel: string;
  items: DashboardAttentionItem[];
};

export type WorkspaceDashboard = {
  headline: DashboardMetric[];
  hoursTrend: DashboardSeries;
  statusBreakdown: DashboardBreakdown;
  blockerBreakdown: DashboardBreakdown;
  topProjectsByHours: DashboardRankedList;
  /** Null for a caller with no business seeing a colleague leaderboard. */
  topContributors: DashboardRankedList | null;
  projects: DashboardProject[];
  projectTotal: number;
  attention: DashboardAttention;
  standupComplianceToday: DashboardCompliance;
  /** Null for a caller who cannot track time. */
  myDay: DashboardMyDay | null;
};

export type ClientDashboard = {
  projects: DashboardClientProject[];
  awaitingMyFeedbackCount: number;
};

/** Exactly one of `workspace` and `client` is non-null. `audience` says which. */
export type DashboardResponse = {
  audience: EnumDisplay;
  generatedAt: string;
  range: DashboardRange;
  workspace: WorkspaceDashboard | null;
  client: ClientDashboard | null;
};
