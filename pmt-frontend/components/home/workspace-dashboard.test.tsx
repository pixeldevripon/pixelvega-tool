import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type {
    DashboardProject,
    DashboardProjectBoard,
    DashboardProjectColumn,
    DashboardRankedList,
    DashboardSeries,
    WorkspaceDashboard,
} from '@/types/dashboard';

import { RoleProvider } from '@/contexts/role-context';
import { ROLE_PERMISSIONS } from '@/lib/config/rbac';

import { WorkspaceDashboardView } from './workspace-dashboard';

/**
 * Rendered as an ADMIN unless a case says otherwise, because the deep links on
 * the tiles and rows read the session's permission set. The deny-all default
 * outside a provider would leave every gated link absent, so the cases about
 * gating would pass without testing anything.
 */
const view = (
    workspace: WorkspaceDashboard,
    permissions: string[] = ROLE_PERMISSIONS.ADMIN,
) =>
    render(
        <RoleProvider permissions={permissions}>
            <WorkspaceDashboardView workspace={workspace} />
        </RoleProvider>,
    );

const series = (label: string): DashboardSeries => ({
    label,
    points: [
        {
            date: '2026-08-17',
            label: 'Mon 17',
            value: 480,
            valueLabel: '8h',
            isWorkingDay: true,
            isPeak: true,
        },
        {
            date: '2026-08-18',
            label: 'Tue 18',
            value: 120,
            valueLabel: '2h',
            isWorkingDay: true,
            isPeak: false,
        },
    ],
    totalValue: 600,
    totalLabel: '10h',
    dailyTarget: 480,
});

const ranked = (label: string, rows: string[]): DashboardRankedList => ({
    label,
    caption: 'Last 14 days',
    rows: rows.map((name, index) => ({
        id: `r-${index}`,
        name,
        subtitle: null,
        avatarUrl: null,
        value: 120,
        valueLabel: '2h',
        share: 0.5,
        changeRate: null,
        changeLabel: null,
        tone: { value: 'default', label: 'Steady', tone: 'default' },
    })),
});

/**
 * A one-column board. The grouping itself is the API's job and has its own specs
 * on both sides, so what these cases care about is that the view renders the
 * columns it was handed and gates everything around them.
 */
const board = (
    projects: DashboardProject[],
    overrides: Partial<DashboardProjectColumn> = {},
): DashboardProjectBoard => ({
    columns: [
        {
            phase: { value: 'IN_PROGRESS', label: 'In progress', tone: 'primary' },
            total: projects.length,
            totalLabel: `${projects.length} projects`,
            hiddenCount: 0,
            hiddenLabel: null,
            projects,
            ...overrides,
        },
    ],
    total: projects.length,
});

const project = (id: string, name: string): DashboardProject => ({
    id,
    name,
    description: null,
    status: { value: 'IN_PROGRESS', label: 'In progress', tone: 'primary' },
    priority: { value: 'HIGH', label: 'High', tone: 'warning' },
    types: [],
    deadline: null,
    daysUntilDeadline: null,
    deadlineLabel: null,
    isOverdue: false,
    isAtRisk: false,
    isTerminal: false,
    plannedStartDate: null,
    progressPercentage: 40,
    estimatedHours: null,
    actualHours: 0,
    actualHoursLabel: '0m',
    estimatedHoursLabel: null,
    remainingHours: null,
    remainingHoursLabel: null,
    hoursUsedRate: null,
    isActive: true,
    openBlockerCount: 0,
    highSeverityBlockerCount: 0,
    minutesInRange: 0,
    minutesInRangeLabel: '0m',
    lastWorkedAt: null,
    members: [],
    capabilities: { canManage: false, canTrackTime: false, isMember: false },
});

const workspace = (
    overrides: Partial<WorkspaceDashboard> = {},
): WorkspaceDashboard => ({
    headline: [
        {
            key: 'activeProjects',
            label: 'Active projects',
            caption: null,
            value: 14,
            valueLabel: '14',
            previousValue: 11,
            changeRate: 0.27,
            changeLabel: '+27%',
            tone: { value: 'success', label: 'Improving', tone: 'success' },
        },
        {
            key: 'hoursLogged',
            label: 'Hours logged',
            caption: 'Last 14 days',
            value: 5400,
            valueLabel: '90h',
            previousValue: null,
            changeRate: null,
            changeLabel: null,
            tone: { value: 'default', label: 'Steady', tone: 'default' },
        },
    ],
    hoursTrend: series('Hours logged'),
    statusBreakdown: {
        label: 'Projects by status',
        total: 14,
        totalLabel: '14 projects',
        slices: [
            {
                key: {
                    value: 'IN_PROGRESS',
                    label: 'In progress',
                    tone: 'primary',
                },
                count: 6,
                share: 0.42,
                shareLabel: '42%',
            },
        ],
    },
    blockerBreakdown: {
        label: 'Blockers by severity',
        total: 3,
        totalLabel: '3 blockers',
        slices: [
            {
                key: { value: 'HIGH', label: 'High', tone: 'danger' },
                count: 3,
                share: 1,
                shareLabel: '100%',
            },
        ],
    },
    topProjectsByHours: ranked('Top projects by hours', ['Acme site']),
    topContributors: ranked('Busiest people', ['Jabed Hasan']),
    projectBoard: board([project('p-1', 'Acme corporate site')]),
    projectTotal: 1,
    attention: {
        total: 4,
        totalLabel: '4 waiting',
        items: [
            {
                key: 'overdueProjects',
                label: 'Overdue projects',
                count: 4,
                tone: { value: 'overdue', label: 'Past due', tone: 'danger' },
            },
        ],
    },
    standupComplianceToday: {
        submitted: 9,
        expected: 12,
        rate: 0.75,
        rateLabel: '75%',
    },
    myDay: null,
    ...overrides,
});

describe('WorkspaceDashboardView', () => {
    it('puts the project board first, above the figures', () => {
        // The whole point of the redesign. The work used to sit under four
        // screens of aggregate, which put the answer below every summary of it.
        const { container } = view(workspace());

        const sections = Array.from(container.querySelectorAll('section'));
        expect(sections[0].textContent).toContain('In progress');
        expect(sections[0].querySelector('a[href^="/projects/"]')).not.toBeNull();
    });

    it('renders one tile per headline metric, in the order they arrived', () => {
        view(workspace());

        const tiles = screen.getAllByText(/Active projects|Hours logged/);
        expect(tiles[0]).toHaveTextContent('Active projects');
    });

    it('renders every block the response carried', () => {
        view(workspace());

        expect(screen.getByText('Projects by status')).toBeInTheDocument();
        expect(screen.getByText('Blockers by severity')).toBeInTheDocument();
        expect(screen.getByText('Top projects by hours')).toBeInTheDocument();
        expect(screen.getByText('Needs attention')).toBeInTheDocument();
        expect(screen.getByText('Standups today')).toBeInTheDocument();
    });

    it('renders the board columns it was given', () => {
        view(
            workspace({
                projectBoard: board([
                    project('p-1', 'First project'),
                    project('p-2', 'Second project'),
                ]),
            }),
        );

        const links = screen
            .getAllByRole('link')
            .filter((link) =>
                link.getAttribute('href')?.startsWith('/projects/'),
            );
        expect(links.map((link) => link.textContent)).toEqual([
            'First project',
            'Second project',
        ]);
    });

    it('links the section heading to the full projects list', () => {
        view(workspace());

        expect(screen.getByRole('link', { name: /View all/ })).toHaveAttribute(
            'href',
            '/projects',
        );
    });

    // ── Every null is a permission gate: absent, never empty ──

    it('omits My day entirely when the caller cannot track time', () => {
        // A project manager holds no TRACK_PROJECT_TIME, and an empty timer card
        // would imply a control they do not have.
        view(workspace());

        expect(screen.queryByText('My day')).not.toBeInTheDocument();
    });

    it('renders My day when the response carried it', () => {
        view(
            workspace({
                myDay: {
                    activeTimer: null,
                    today: { minutes: 0, hours: 0, label: '0m' },
                    thisWeek: { minutes: 0, hours: 0, label: '0m' },
                    weekTargetMinutes: 2880,
                    weekTargetLabel: '48h',
                    weekProgressRate: 0,
                    weekProgressLabel: '0%',
                    myHoursTrend: series('My hours'),
                    todayWorkReportStatus: null,
                    myOpenBlockerCount: 0,
                },
            }),
        );

        expect(screen.getByText('My day')).toBeInTheDocument();
    });

    it('omits the contributor leaderboard when it is null', () => {
        // Null means "this does not concern you", not "nobody logged hours". An
        // empty list would claim the second.
        view(workspace({ topContributors: null }));

        expect(screen.queryByText('Busiest people')).not.toBeInTheDocument();
    });

    it('omits the blocker breakdown when the caller may not see blockers', () => {
        view(workspace({ blockerBreakdown: null }));

        expect(
            screen.queryByText('Blockers by severity'),
        ).not.toBeInTheDocument();
    });

    it('omits the hours leaderboard when the caller may not see time', () => {
        view(workspace({ topProjectsByHours: null }));

        expect(
            screen.queryByText('Top projects by hours'),
        ).not.toBeInTheDocument();
    });

    it('omits the standup gauge when the caller may not see work reports', () => {
        view(workspace({ standupComplianceToday: null }));

        expect(screen.queryByText('Standups today')).not.toBeInTheDocument();
    });

    it('renders the tiles the response sent and no others', () => {
        // The headline array arrives already gated, so a tile the caller may not
        // see is simply not in it. This view must not add one back.
        view(
            workspace({
                headline: [
                    {
                        key: 'activeProjects',
                        label: 'Active projects',
                        caption: null,
                        value: 3,
                        valueLabel: '3',
                        previousValue: null,
                        changeRate: null,
                        changeLabel: null,
                        tone: {
                            value: 'neutral',
                            label: 'Steady',
                            tone: 'default',
                        },
                    },
                ],
            }),
        );

        expect(screen.getByText('Active projects')).toBeInTheDocument();
        expect(screen.queryByText('Open blockers')).not.toBeInTheDocument();
        expect(screen.queryByText('At risk')).not.toBeInTheDocument();
    });

    // ── Deep links ──

    it('links a status slice to the projects list filtered by it', () => {
        view(workspace());

        expect(
            screen.getByRole('link', { name: /In progress 6 42%/ }),
        ).toHaveAttribute('href', '/projects?status=IN_PROGRESS');
    });

    it('links a severity slice to the blockers list filtered by it', () => {
        view(workspace());

        expect(
            screen.getByRole('link', { name: /High 3 100%/ }),
        ).toHaveAttribute('href', '/blockers?severity=HIGH');
    });

    it('gates the severity link by gating the whole card, not the row', () => {
        /**
         * The slice's href carries no permission check of its own, and that is
         * correct rather than an omission: the card only exists when the server
         * sent `blockerBreakdown`, and it only sends that to a caller holding
         * `VIEW_BLOCKERS`. So reaching the row already proves the link is
         * followable, and a second gate here could only ever disagree with the
         * first. Null card, therefore no link anywhere on the page.
         */
        view(workspace({ blockerBreakdown: null }));

        const severityLinks = screen
            .getAllByRole('link')
            .filter((link) =>
                link.getAttribute('href')?.startsWith('/blockers'),
            );
        expect(severityLinks).toHaveLength(0);
    });

    it('links a ranked project row to that project in the list', () => {
        // There is no project detail screen yet, so the row opens the list
        // narrowed to it rather than a route that does not exist.
        view(workspace());

        const row = screen
            .getAllByRole('link')
            .find((link) =>
                link.getAttribute('href')?.startsWith('/projects?search='),
            );
        expect(row).toHaveAttribute('href', '/projects?search=Acme%20site');
    });

    it('links a ranked contributor row to that person in the team list', () => {
        view(workspace());

        const row = screen
            .getAllByRole('link')
            .find((link) =>
                link.getAttribute('href')?.startsWith('/users?search='),
            );
        expect(row).toHaveAttribute('href', '/users?search=Jabed%20Hasan');
    });
});
