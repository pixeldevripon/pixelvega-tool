import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { DashboardMember, DashboardProject } from '@/types/dashboard';

import { ProjectCard } from './project-card';

const member = (id: string, name: string): DashboardMember => ({
    id,
    name,
    avatarUrl: null,
    projectRole: {
        value: 'DEVELOPER',
        label: 'Developer',
        tone: 'default',
    },
});

const project = (
    overrides: Partial<DashboardProject> = {},
): DashboardProject => ({
    id: 'p-1',
    name: 'Acme corporate site',
    status: { value: 'IN_PROGRESS', label: 'In progress', tone: 'primary' },
    priority: { value: 'HIGH', label: 'High', tone: 'warning' },
    types: [{ value: 'WORDPRESS', label: 'WordPress', tone: 'default' }],
    deadline: '2026-09-15T00:00:00.000Z',
    daysUntilDeadline: 12,
    deadlineLabel: 'in 12 days',
    isOverdue: false,
    isAtRisk: false,
    plannedStartDate: null,
    progressPercentage: 40,
    estimatedHours: 120,
    actualHours: 47.5,
    actualHoursLabel: '47h 30m',
    estimatedHoursLabel: '120h',
    remainingHours: 72.5,
    remainingHoursLabel: '72h 30m',
    hoursUsedRate: 0.4,
    isActive: true,
    openBlockerCount: 0,
    highSeverityBlockerCount: 0,
    minutesInRange: 450,
    minutesInRangeLabel: '7h 30m',
    lastWorkedAt: '2026-08-20T09:15:00.000Z',
    members: [member('u-1', 'Jabed Hasan')],
    capabilities: { canManage: false, canTrackTime: true, isMember: true },
    ...overrides,
});

describe('ProjectCard', () => {
    it('links the name to the project', () => {
        render(<ProjectCard project={project()} />);

        expect(
            screen.getByRole('link', { name: 'Acme corporate site' }),
        ).toHaveAttribute('href', '/projects/p-1');
    });

    it('renders the priority and the status the server decided', () => {
        render(<ProjectCard project={project()} />);

        expect(screen.getByText('High')).toBeInTheDocument();
        expect(screen.getByText('In progress')).toBeInTheDocument();
    });

    it('renders the hours LABELS, never the floats', () => {
        // `actualHours` is a sum of minutes over sixty, so rendering it raw put
        // "56.083333333333336h" on screen.
        render(
            <ProjectCard
                project={project({
                    actualHours: 56.083333333333336,
                    actualHoursLabel: '56h 5m',
                })}
            />,
        );

        expect(
            screen.getByText(/56h 5m of 120h/),
        ).toBeInTheDocument();
        expect(
            screen.queryByText(/56.0833/),
        ).not.toBeInTheDocument();
    });

    it('reads "logged" when the project has no estimate', () => {
        render(
            <ProjectCard
                project={project({
                    estimatedHours: null,
                    estimatedHoursLabel: null,
                    hoursUsedRate: null,
                })}
            />,
        );

        expect(screen.getByText(/47h 30m logged/)).toBeInTheDocument();
    });

    it('says so when the estimate has been exceeded', () => {
        render(<ProjectCard project={project({ hoursUsedRate: 1.15 })} />);

        expect(screen.getByText('over estimate')).toBeInTheDocument();
    });

    it('says nothing about the estimate when it has not been exceeded', () => {
        render(<ProjectCard project={project({ hoursUsedRate: 0.4 })} />);

        expect(screen.queryByText('over estimate')).not.toBeInTheDocument();
    });

    it('emphasises the card from isAtRisk alone', () => {
        // One flag, so a card, a count and a filter cannot disagree about what
        // at risk means.
        const { container } = render(
            <ProjectCard project={project({ isAtRisk: true })} />,
        );

        expect(container.firstElementChild?.className).toContain(
            'border-danger-border',
        );
    });

    it('shows at most four avatars and counts the rest', () => {
        render(
            <ProjectCard
                project={project({
                    members: [
                        member('u-1', 'One person'),
                        member('u-2', 'Two person'),
                        member('u-3', 'Three person'),
                        member('u-4', 'Four person'),
                        member('u-5', 'Five person'),
                        member('u-6', 'Six person'),
                    ],
                })}
            />,
        );

        expect(screen.getByText('+2')).toBeInTheDocument();
    });

    it('shows no overflow chip when everyone fits', () => {
        render(
            <ProjectCard
                project={project({
                    members: [member('u-1', 'One'), member('u-2', 'Two')],
                })}
            />,
        );

        expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
    });

    it('warns when nobody is staffed', () => {
        render(<ProjectCard project={project({ members: [] })} />);

        expect(screen.getByText('Nobody staffed')).toBeInTheDocument();
    });

    it('hides the blocker metric when there are none', () => {
        render(<ProjectCard project={project({ openBlockerCount: 0 })} />);

        expect(screen.queryByTitle(/open/)).not.toBeInTheDocument();
    });

    it('names the high severity count in the blocker title', () => {
        render(
            <ProjectCard
                project={project({
                    openBlockerCount: 3,
                    highSeverityBlockerCount: 1,
                })}
            />,
        );

        expect(
            screen.getByTitle('1 at high severity'),
        ).toBeInTheDocument();
    });

    it('hides the hours metric when nothing was logged in the window', () => {
        render(
            <ProjectCard
                project={project({
                    minutesInRange: 0,
                    minutesInRangeLabel: '0m',
                })}
            />,
        );

        expect(
            screen.queryByTitle('Logged in this window'),
        ).not.toBeInTheDocument();
    });

    it('marks an overdue deadline rather than leaving it plain', () => {
        render(
            <ProjectCard
                project={project({
                    isOverdue: true,
                    daysUntilDeadline: -3,
                    deadlineLabel: '3 days overdue',
                })}
            />,
        );

        expect(screen.getByText('3 days overdue').className).toContain(
            'text-danger-fg',
        );
    });

    it('omits the deadline line when there is no deadline', () => {
        render(
            <ProjectCard
                project={project({
                    deadline: null,
                    daysUntilDeadline: null,
                    deadlineLabel: null,
                })}
            />,
        );

        expect(screen.queryByText(/overdue|in \d+ days/)).not.toBeInTheDocument();
    });
});
