import {
    AlertDiamondIcon,
    Beach02Icon,
    Calendar03Icon,
    CalendarCheckIn01Icon,
    Chart01Icon,
    DashboardSquare01Icon,
    File02Icon,
    Layers01Icon,
    NoteEditIcon,
    SecurityCheckIcon,
    SparklesIcon,
    Task01Icon,
    ThumbsUpIcon,
    Timer01Icon,
    UserGroupIcon,
} from '@hugeicons/core-free-icons';

import { Permission } from '@/lib/config/rbac';
import type { NavGroup } from '@/lib/rbac-utils';

/**
 * Dashboard navigation: five groups by TASK FREQUENCY, not by entity type.
 *
 * A developer opens Projects and My Day every morning and AI Templates never;
 * a flat alphabetical list makes those equally prominent, which is the defect
 * this structure replaces.
 *
 * ── Per-role IA falls out of permission filtering, not out of a role map ──
 *
 * `filterNavGroups` drops any item whose `permissions` the caller does not
 * hold, then drops any group left empty. A CLIENT holds none of the internal
 * project permissions, so Deliver, Insight, People and Configure disappear
 * with their contents: never greyed out, absent. There is no `Record<Role,
 * NavItem[]>` anywhere, deliberately, because that is a second copy of
 * `ROLE_PERMISSIONS` written in a different language (D2).
 *
 * `permissions` is ANY-of. An item appears if the caller holds at least one.
 *
 * ── Two rules for choosing the gate ──
 *
 * 1. **Gate a cross-project queue on `VIEW_ALL_PROJECTS`**, which only a
 *    PROJECT_MANAGER and above hold. A Developer reaches reviews, feedback and
 *    requirements through the project they are staffed on, not through a
 *    company-wide list they are not entitled to see.
 * 2. **Never gate on a permission from the `EVERYONE` set** unless the item
 *    really is for all six roles. `VIEW_HOLIDAYS` is granted to a CLIENT, so
 *    gating the holiday calendar on it would put the company's leave calendar
 *    in a client's sidebar. Holidays is gated on `REQUEST_LEAVE` instead,
 *    which is what "this calendar concerns you" actually means.
 *
 * `url` values are relative and root-less (`''` for Overview), matching the
 * reference convention that `nav-main.tsx` and `command-palette.tsx` both
 * resolve through `toHref`.
 */
const dashboardNav: NavGroup[] = [
    {
        // Daily. Everyone's morning screen-set.
        label: 'Work',
        items: [
            {
                title: 'Overview',
                url: '',
                icon: DashboardSquare01Icon,
                // Every role lands here, and the API decides which dashboard
                // the caller gets. VIEW_OWN_PROJECTS is in the EVERYONE set,
                // which is correct for exactly this one item.
                permissions: [Permission.VIEW_OWN_PROJECTS],
            },
            {
                title: 'Projects',
                url: 'projects',
                icon: Layers01Icon,
                permissions: [
                    Permission.VIEW_OWN_PROJECTS,
                    Permission.VIEW_ALL_PROJECTS,
                ],
            },
            {
                // THE daily habit for delivery staff: the timer plus today's
                // standup and wrap-up in one place. A PM does not hold
                // TRACK_PROJECT_TIME or SUBMIT_WORK_REPORT, so this row is
                // absent for them and they read the same work under Standups.
                title: 'My day',
                url: 'my-day',
                icon: Timer01Icon,
                permissions: [
                    Permission.TRACK_PROJECT_TIME,
                    Permission.SUBMIT_WORK_REPORT,
                ],
            },
            {
                title: 'Standups',
                url: 'standups',
                icon: Task01Icon,
                permissions: [Permission.VIEW_WORK_REPORTS],
            },
            {
                title: 'Blockers',
                url: 'blockers',
                icon: AlertDiamondIcon,
                permissions: [Permission.VIEW_BLOCKERS],
            },
            {
                title: 'Time',
                url: 'time',
                icon: Calendar03Icon,
                permissions: [Permission.VIEW_TIME_ENTRIES],
            },
        ],
    },
    {
        // The project flow: what moves a project from work to delivered.
        // Every row is a cross-project queue, so every row is PM and above.
        label: 'Deliver',
        items: [
            {
                title: 'Requirements',
                url: 'requirements',
                icon: NoteEditIcon,
                permissions: [Permission.REVIEW_ADDITIONAL_REQUIREMENT],
            },
            {
                title: 'Internal reviews',
                url: 'reviews',
                icon: SecurityCheckIcon,
                permissions: [Permission.SUBMIT_INTERNAL_REVIEW],
            },
            {
                title: 'Client feedback',
                url: 'client-feedback',
                icon: ThumbsUpIcon,
                // NOT VIEW_CLIENT_FEEDBACK: a CLIENT holds that, and this is
                // the cross-project queue. A client reaches their own feedback
                // from their project.
                permissions: [Permission.VIEW_ALL_PROJECTS],
            },
        ],
    },
    {
        // Read, not act. Opened weekly rather than hourly.
        label: 'Insight',
        items: [
            {
                title: 'Reports',
                url: 'reports',
                icon: Chart01Icon,
                permissions: [
                    Permission.VIEW_PROJECT_REPORTS,
                    Permission.VIEW_DEVELOPER_REPORTS,
                ],
            },
            {
                title: 'AI',
                url: 'ai',
                icon: SparklesIcon,
                permissions: [
                    Permission.GENERATE_STATUS_REPORT,
                    Permission.VIEW_STATUS_REPORTS,
                    Permission.RUN_SCOPE_CHECK,
                ],
            },
        ],
    },
    {
        label: 'People',
        items: [
            {
                title: 'Team',
                url: 'users',
                icon: UserGroupIcon,
                permissions: [Permission.VIEW_USERS],
            },
            {
                title: 'Leave',
                url: 'leave',
                icon: Beach02Icon,
                permissions: [
                    Permission.REQUEST_LEAVE,
                    Permission.VIEW_LEAVE_REQUESTS,
                ],
            },
            {
                title: 'Holidays',
                url: 'holidays',
                icon: CalendarCheckIn01Icon,
                // REQUEST_LEAVE, not VIEW_HOLIDAYS: see rule 2 in the header.
                permissions: [Permission.REQUEST_LEAVE],
            },
        ],
    },
    {
        // Set up once, changed rarely. **One row per permission, never a single
        // "Settings" row behind an ANY-of gate**: a PROJECT_MANAGER holds
        // MANAGE_BLOCKER_REASONS and nothing else here, so a lumped row would
        // open a screen where three of its four sections are refused. The
        // navigations spec pins this per role.
        label: 'Configure',
        items: [
            {
                // A PM or an Admin controls what reasons appear on the
                // blocker list, so this is deliberately not admin-only.
                title: 'Blocker reasons',
                url: 'settings/blocker-reasons',
                icon: AlertDiamondIcon,
                permissions: [Permission.MANAGE_BLOCKER_REASONS],
            },
            {
                title: 'Leave types',
                url: 'settings/leave-types',
                icon: Beach02Icon,
                permissions: [Permission.MANAGE_LEAVE_TYPES],
            },
            {
                // Readable by every internal role, writable by an Admin. The
                // write controls are gated inside the screen from
                // MANAGE_AI_TEMPLATES.
                title: 'AI templates',
                url: 'settings/ai-templates',
                icon: File02Icon,
                permissions: [Permission.VIEW_AI_TEMPLATES],
            },
            {
                title: 'Audit log',
                url: 'audit-logs',
                icon: SecurityCheckIcon,
                permissions: [Permission.VIEW_AUDIT_LOG],
            },
        ],
    },
];

/**
 * Your Profile is deliberately NOT a nav row. It is reached from the identity
 * dropdown in the site header, which every role has, so a row here would be a
 * second door to the same page taking space in the daily screen-set.
 */
export interface NavigationMap {
    dashboard: NavGroup[];
}

export function getNavigations(): NavigationMap {
    return { dashboard: dashboardNav };
}
