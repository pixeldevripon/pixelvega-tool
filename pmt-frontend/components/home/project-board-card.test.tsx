import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { DashboardMember, DashboardProject } from '@/types/dashboard';

import { ProjectBoardCard } from './project-board-card';

/**
 * Adapted from the old `project-card.test.tsx`. The card it covered was the
 * twelve-wide grid's card, which the board replaced; every case here that still
 * describes real behaviour was kept, and the ones about a progress bar and an
 * "over estimate" caption were dropped because the board card has neither.
 */

const member = (id: string, name: string): DashboardMember => ({
    id,
    name,
    avatarUrl: null,
    projectRole: { value: 'DEVELOPER', label: 'Developer', tone: 'default' },
});

const project = (
    overrides: Partial<DashboardProject> = {},
): DashboardProject => ({
    id: 'p-1',
    name: 'Acme corporate site',
    description: 'Five page marketing site plus a blog.',
    status: { value: 'IN_PROGRESS', label: 'In progress', tone: 'primary' },
    priority: { value: 'HIGH', label: 'High', tone: 'warning' },
    types: [{ value: 'WORDPRESS', label: 'WordPress', tone: 'default' }],
    deadline: '2026-09-15T00:00:00.000Z',
    daysUntilDeadline: 12,
    deadlineLabel: 'in 12 days',
    isOverdue: false,
    isAtRisk: false,
    isTerminal: false,
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

describe('ProjectBoardCard', () => {
    it('links the name to the project', () => {
        render(<ProjectBoardCard project={project()} />);

        expect(
            screen.getByRole('link', { name: 'Acme corporate site' }),
        ).toHaveAttribute('href', '/projects/p-1');
    });

    it('renders the priority and the status the server decided', () => {
        // Both, not one. The lane is a phase, so "Closed" holds cancelled
        // projects too, and the status badge is what tells them apart.
        render(<ProjectBoardCard project={project()} />);

        expect(screen.getByText('High')).toBeInTheDocument();
        expect(screen.getByText('In progress')).toBeInTheDocument();
    });

    it('renders the description as the second line', () => {
        render(<ProjectBoardCard project={project()} />);

        expect(
            screen.getByText('Five page marketing site plus a blog.'),
        ).toBeInTheDocument();
    });

    it('reserves the description space but writes no placeholder in it', () => {
        /**
         * The slot is always there, so two cards side by side keep the same
         * height whether or not somebody wrote a description. What must NOT
         * appear is invented copy: no "No description", no em dash. The space is
         * simply empty.
         */
        const { container } = render(
            <ProjectBoardCard project={project({ description: null })} />,
        );

        const slot = container.querySelector('p.line-clamp-2');
        expect(slot).not.toBeNull();
        expect(slot?.textContent).toBe('');
        expect(screen.queryByText(/marketing site/)).not.toBeInTheDocument();
    });

    it('renders the hours LABEL, never the float', () => {
        // `actualHours` is a sum of minutes over sixty, so rendering it raw put
        // "56.083333333333336h" on screen.
        render(
            <ProjectBoardCard
                project={project({
                    actualHours: 56.083333333333336,
                    actualHoursLabel: '56h 5m',
                })}
            />,
        );

        expect(screen.getByText('56h 5m')).toBeInTheDocument();
        expect(screen.queryByText(/56\.0833/)).not.toBeInTheDocument();
    });

    it('names the estimate in the hours title when there is one', () => {
        render(<ProjectBoardCard project={project()} />);

        expect(
            screen.getByTitle('Logged, against an estimate of 120h'),
        ).toBeInTheDocument();
    });

    it('says only "logged in total" when there is no estimate', () => {
        render(
            <ProjectBoardCard
                project={project({
                    estimatedHours: null,
                    estimatedHoursLabel: null,
                    hoursUsedRate: null,
                })}
            />,
        );

        expect(screen.getByTitle('Logged in total')).toBeInTheDocument();
    });

    it('does not tint the card for isAtRisk', () => {
        /**
         * The tint is deliberately gone. A Critical or Urgent project is
         * usually also overdue or blocked, so nearly every high-priority card
         * came out pink and the danger surface stopped distinguishing anything
         * from anything. Pinned so it cannot come back by reflex.
         */
        const { container } = render(
            <ProjectBoardCard project={project({ isAtRisk: true })} />,
        );

        const className = container.firstElementChild?.className ?? '';
        expect(className).not.toContain('border-danger-border');
        expect(className).not.toContain('bg-danger');
    });

    it('still marks the risk where it is specific', () => {
        // Removing the tint must not remove the signal. The deadline line and
        // the high-severity blocker count are where it lives now.
        render(
            <ProjectBoardCard
                project={project({
                    isAtRisk: true,
                    isOverdue: true,
                    deadlineLabel: '3 days overdue',
                    openBlockerCount: 2,
                    highSeverityBlockerCount: 2,
                })}
            />,
        );

        expect(screen.getByText(/3 days overdue/).className).toContain(
            'text-danger-fg',
        );
        expect(screen.getByTitle('2 at high severity').className).toContain(
            'text-danger-fg',
        );
    });

    it('shows at most four avatars and counts the rest', () => {
        render(
            <ProjectBoardCard
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
            <ProjectBoardCard
                project={project({
                    members: [member('u-1', 'One'), member('u-2', 'Two')],
                })}
            />,
        );

        expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
    });

    it('warns when nobody is staffed', () => {
        render(<ProjectBoardCard project={project({ members: [] })} />);

        expect(screen.getByText('Nobody staffed')).toBeInTheDocument();
    });

    it('hides the blocker metric when there are none', () => {
        render(<ProjectBoardCard project={project({ openBlockerCount: 0 })} />);

        expect(screen.queryByTitle(/open$/)).not.toBeInTheDocument();
    });

    it('names the high severity count in the blocker title', () => {
        render(
            <ProjectBoardCard
                project={project({
                    openBlockerCount: 3,
                    highSeverityBlockerCount: 1,
                })}
            />,
        );

        expect(screen.getByTitle('1 at high severity')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('reports the open count when none are high severity', () => {
        render(
            <ProjectBoardCard
                project={project({
                    openBlockerCount: 2,
                    highSeverityBlockerCount: 0,
                })}
            />,
        );

        expect(screen.getByTitle('2 open')).toBeInTheDocument();
    });

    it('shows the progress percentage the server derived', () => {
        render(
            <ProjectBoardCard project={project({ progressPercentage: 65 })} />,
        );

        expect(screen.getByText('65%')).toBeInTheDocument();
    });

    it('marks an overdue deadline rather than leaving it plain', () => {
        render(
            <ProjectBoardCard
                project={project({
                    isOverdue: true,
                    daysUntilDeadline: -3,
                    deadlineLabel: '3 days overdue',
                })}
            />,
        );

        expect(screen.getByText(/3 days overdue/).className).toContain(
            'text-danger-fg',
        );
    });

    it('prints the deadline once, in the API wording', () => {
        // This card printed the countdown a second time in its own words, so it
        // read "347 days overdue · 347d overdue".
        render(
            <ProjectBoardCard
                project={project({
                    isOverdue: true,
                    daysUntilDeadline: -347,
                    deadlineLabel: '347 days overdue',
                })}
            />,
        );

        expect(screen.getAllByText(/overdue/)).toHaveLength(1);
        expect(screen.queryByText(/347d/)).not.toBeInTheDocument();
    });

    it('prints no countdown on a finished project', () => {
        /**
         * A completed project keeps its deadline, so `deadlineLabel` still
         * reads "138 days overdue" and `isOverdue` is deliberately false for
         * it. The board printed exactly that under a CANCELLED project, in
         * grey, which reads as a live project that is very late.
         */
        render(
            <ProjectBoardCard
                project={project({
                    status: {
                        value: 'COMPLETED',
                        label: 'Completed',
                        tone: 'success',
                    },
                    isTerminal: true,
                    isOverdue: false,
                    daysUntilDeadline: -138,
                    deadlineLabel: '138 days overdue',
                })}
            />,
        );

        expect(screen.queryByText(/138 days overdue/)).not.toBeInTheDocument();
        // The status is still on the card, so the lane stays readable.
        expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('prints no countdown on a finished project with a future deadline', () => {
        // The other half of the same nonsense: "in 4 days" on work that is done.
        render(
            <ProjectBoardCard
                project={project({
                    isTerminal: true,
                    daysUntilDeadline: 4,
                    deadlineLabel: 'in 4 days',
                })}
            />,
        );

        expect(screen.queryByText(/in 4 days/)).not.toBeInTheDocument();
    });

    it('omits the deadline line when there is no deadline', () => {
        render(
            <ProjectBoardCard
                project={project({
                    deadline: null,
                    daysUntilDeadline: null,
                    deadlineLabel: null,
                })}
            />,
        );

        expect(
            screen.queryByText(/overdue|in \d+ days/),
        ).not.toBeInTheDocument();
    });
});
