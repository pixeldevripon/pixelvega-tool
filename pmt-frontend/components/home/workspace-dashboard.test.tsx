import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type {
    DashboardProject,
    DashboardRankedList,
    DashboardSeries,
    WorkspaceDashboard,
} from '@/types/dashboard';

import { WorkspaceDashboardView } from './workspace-dashboard';

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

const project = (id: string, name: string): DashboardProject => ({
    id,
    name,
    status: { value: 'IN_PROGRESS', label: 'In progress', tone: 'primary' },
    priority: { value: 'HIGH', label: 'High', tone: 'warning' },
    types: [],
    deadline: null,
    daysUntilDeadline: null,
    deadlineLabel: null,
    isOverdue: false,
    isAtRisk: false,
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
    projects: [project('p-1', 'Acme corporate site')],
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
    it('renders one tile per headline metric, in the order they arrived', () => {
        render(<WorkspaceDashboardView workspace={workspace()} />);

        const tiles = screen.getAllByText(/Active projects|Hours logged/);
        expect(tiles[0]).toHaveTextContent('Active projects');
    });

    it('renders every block the response carried', () => {
        render(<WorkspaceDashboardView workspace={workspace()} />);

        expect(screen.getByText('Projects by status')).toBeInTheDocument();
        expect(screen.getByText('Blockers by severity')).toBeInTheDocument();
        expect(screen.getByText('Top projects by hours')).toBeInTheDocument();
        expect(screen.getByText('Needs attention')).toBeInTheDocument();
        expect(screen.getByText('Standups today')).toBeInTheDocument();
    });

    it('omits My day entirely when the caller cannot track time', () => {
        // A project manager holds no TRACK_PROJECT_TIME, and an empty timer card
        // would imply a control they do not have.
        render(<WorkspaceDashboardView workspace={workspace()} />);

        expect(screen.queryByText('My day')).not.toBeInTheDocument();
    });

    it('renders My day when the response carried it', () => {
        render(
            <WorkspaceDashboardView
                workspace={workspace({
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
                })}
            />,
        );

        expect(screen.getByText('My day')).toBeInTheDocument();
    });

    it('omits the contributor leaderboard when it is null', () => {
        // Null means "this does not concern you", not "nobody logged hours". An
        // empty list would claim the second.
        render(
            <WorkspaceDashboardView
                workspace={workspace({ topContributors: null })}
            />,
        );

        expect(screen.queryByText('Busiest people')).not.toBeInTheDocument();
    });

    it('renders the projects in the order they arrived', () => {
        render(
            <WorkspaceDashboardView
                workspace={workspace({
                    projects: [
                        project('p-1', 'First project'),
                        project('p-2', 'Second project'),
                    ],
                    projectTotal: 2,
                })}
            />,
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

    it('says how many projects were left out of the slice', () => {
        render(
            <WorkspaceDashboardView
                workspace={workspace({ projectTotal: 22 })}
            />,
        );

        expect(screen.getByRole('link', { name: /21 more/ })).toHaveAttribute(
            'href',
            '/projects',
        );
    });

    it('offers no "more" link when the slice is the whole list', () => {
        render(<WorkspaceDashboardView workspace={workspace()} />);

        expect(screen.queryByText(/more$/)).not.toBeInTheDocument();
    });

    it('says so when the caller has no projects at all', () => {
        render(
            <WorkspaceDashboardView
                workspace={workspace({ projects: [], projectTotal: 0 })}
            />,
        );

        expect(
            screen.getByText('No projects are assigned to you yet.'),
        ).toBeInTheDocument();
    });
});
