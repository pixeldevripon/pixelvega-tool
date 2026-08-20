import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type {
    DashboardProject,
    DashboardProjectBoard,
    DashboardProjectColumn,
} from '@/types/dashboard';

import { ProjectBoard } from './project-board';

/**
 * The board renders what it is given and nothing else. So the cases that matter
 * are the ones where it would be tempting to compute: the header count, the
 * overflow link, and whether an empty lane survives.
 */

const project = (id: string, name: string): DashboardProject => ({
    id,
    name,
    description: null,
    status: { value: 'IN_PROGRESS', label: 'In progress', tone: 'primary' },
    priority: { value: 'LOW', label: 'Low', tone: 'default' },
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
    capabilities: { canManage: false, canTrackTime: true, isMember: true },
});

const column = (
    overrides: Partial<DashboardProjectColumn> = {},
): DashboardProjectColumn => ({
    phase: { value: 'TO_DO', label: 'To do', tone: 'default' },
    total: 1,
    totalLabel: '1 project',
    hiddenCount: 0,
    hiddenLabel: null,
    projects: [project('p-1', 'Acme site')],
    ...overrides,
});

const board = (columns: DashboardProjectColumn[]): DashboardProjectBoard => ({
    columns,
    total: columns.reduce((sum, c) => sum + c.total, 0),
});

const FOUR: DashboardProjectColumn[] = [
    column({ phase: { value: 'TO_DO', label: 'To do', tone: 'default' } }),
    column({
        phase: {
            value: 'IN_PROGRESS',
            label: 'In progress',
            tone: 'primary',
        },
    }),
    column({
        phase: { value: 'IN_REVIEW', label: 'In review', tone: 'warning' },
    }),
    column({ phase: { value: 'CLOSED', label: 'Closed', tone: 'success' } }),
];

describe('ProjectBoard', () => {
    it('renders the columns in the order the API gave them', () => {
        render(<ProjectBoard board={board(FOUR)} />);

        const headings = screen
            .getAllByRole('heading', { level: 3 })
            .map((h) => h.textContent);

        expect(headings).toEqual([
            'To do',
            'In progress',
            'In review',
            'Closed',
        ]);
    });

    it('renders an empty column rather than dropping it', () => {
        // A board that drops empty lanes changes shape as work moves through
        // it, and a reader loses the place they learned to look.
        render(
            <ProjectBoard
                board={board([
                    column({ projects: [], total: 0, totalLabel: '0 projects' }),
                ])}
            />,
        );

        expect(
            screen.getByRole('heading', { level: 3, name: 'To do' }),
        ).toBeInTheDocument();
        expect(screen.getByText('Nothing here')).toBeInTheDocument();
    });

    it('shows the phase TOTAL in the header, not the number of cards', () => {
        // The whole reason the API sends both. Two cards on the board and
        // nineteen in the lane must read nineteen.
        render(
            <ProjectBoard
                board={board([
                    column({
                        total: 19,
                        totalLabel: '19 projects',
                        hiddenCount: 17,
                        hiddenLabel: '17 more',
                        projects: [
                            project('p-1', 'One'),
                            project('p-2', 'Two'),
                        ],
                    }),
                ])}
            />,
        );

        const header = screen.getByRole('heading', {
            level: 3,
            name: 'To do',
        }).parentElement as HTMLElement;

        expect(within(header).getByText('19')).toBeInTheDocument();
        expect(within(header).queryByText('2')).not.toBeInTheDocument();
    });

    it('links the overflow to the projects list filtered by that phase', () => {
        render(
            <ProjectBoard
                board={board([
                    column({
                        phase: {
                            value: 'IN_REVIEW',
                            label: 'In review',
                            tone: 'warning',
                        },
                        total: 30,
                        totalLabel: '30 projects',
                        hiddenCount: 26,
                        hiddenLabel: '26 more',
                    }),
                ])}
            />,
        );

        // The phase token is the same one `/projects?phase=` accepts, which is
        // what makes this land on the projects the column counted rather than
        // on an approximation of them.
        expect(
            screen.getByRole('link', { name: /26 more/ }),
        ).toHaveAttribute('href', '/projects?phase=IN_REVIEW');
    });

    it('renders no overflow link when nothing is hidden', () => {
        // Driven off `hiddenLabel` being null, not off comparing two numbers
        // here, so the card and the API agree on when there is more to see.
        const { container } = render(
            <ProjectBoard
                board={board([column({ hiddenCount: 0, hiddenLabel: null })])}
            />,
        );

        // Asserted on the HREF, not on the link's text. Rendering the link
        // unconditionally would put an anchor with a null label on the page,
        // which a name-matched query cannot see and a reader can still tab to.
        expect(container.querySelector('a[href*="?phase="]')).toBeNull();
    });

    it('renders a card per project in the column', () => {
        render(
            <ProjectBoard
                board={board([
                    column({
                        total: 2,
                        totalLabel: '2 projects',
                        projects: [
                            project('p-1', 'Acme site'),
                            project('p-2', 'Beta app'),
                        ],
                    }),
                ])}
            />,
        );

        expect(
            screen.getByRole('link', { name: 'Acme site' }),
        ).toHaveAttribute('href', '/projects/p-1');
        expect(
            screen.getByRole('link', { name: 'Beta app' }),
        ).toHaveAttribute('href', '/projects/p-2');
    });

    it('colours the header dot from the phase tone', () => {
        render(
            <ProjectBoard
                board={board([
                    column({
                        phase: {
                            value: 'IN_REVIEW',
                            label: 'In review',
                            tone: 'warning',
                        },
                    }),
                ])}
            />,
        );

        const header = screen.getByRole('heading', {
            level: 3,
            name: 'In review',
        }).parentElement as HTMLElement;

        expect(header.querySelector('span')?.className).toContain(
            'bg-warning-solid',
        );
    });
});
