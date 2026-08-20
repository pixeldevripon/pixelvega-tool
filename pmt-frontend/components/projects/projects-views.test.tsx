import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProjectsBoard } from '@/components/projects/projects-board';
import { ProjectsList } from '@/components/projects/projects-list';
import { ProjectsTimeline } from '@/components/projects/projects-timeline';
import { PROJECT_ROWS } from '@/components/projects/projects.fixture';
import type { TimelineZoom } from '@/components/projects/timeline-scale';
import type { Project } from '@/types/projects';

/**
 * The three views render the same rows three ways. What these cases pin is the
 * part that is easy to get wrong invisibly:
 *
 *   - every project appears exactly once, in every view. A grouping bug drops
 *     rows silently, and a list that is quietly short looks like a filter
 *     working.
 *   - the hours LABEL is on screen and the raw float is not. Rendering
 *     `project.actualHours` shows `56.083333333333336h`, which shipped once.
 *   - the states the seed data happens not to contain: no lead, no deadline,
 *     nobody staffed.
 */

const NOW = Date.UTC(2026, 7, 20);

/** A copy of one row with fields overridden, keeping the rest realistic. */
function variant(index: number, overrides: Partial<Project>): Project {
    return { ...PROJECT_ROWS[index], ...overrides, id: `variant-${index}` };
}

describe('the fixture itself', () => {
    it('came from the API with the label fields present', () => {
        // If this fails the capture is stale and every case below is testing a
        // shape the backend no longer sends.
        for (const project of PROJECT_ROWS) {
            expect(typeof project.actualHoursLabel).toBe('string');
            expect(project.lead === null || 'name' in project.lead).toBe(true);
            expect(Array.isArray(project.members)).toBe(true);
        }
    });
});

describe('ProjectsList', () => {
    it('renders every project exactly once', () => {
        render(<ProjectsList projects={PROJECT_ROWS} />);

        for (const project of PROJECT_ROWS) {
            expect(
                screen.getAllByRole('link', { name: project.name }),
            ).toHaveLength(1);
        }
    });

    it('groups rows under their lead, with a count', () => {
        const rows = [
            variant(0, { lead: PROJECT_ROWS[1].lead, name: 'Shared one' }),
            PROJECT_ROWS[1],
        ];
        render(<ProjectsList projects={rows} />);

        const leadName = PROJECT_ROWS[1].lead!.name;
        expect(screen.getByText(leadName)).toBeInTheDocument();
        // One heading for the pair, not one per project.
        expect(screen.getAllByText(leadName)).toHaveLength(1);
        expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('shows the hours label and never the raw float', () => {
        const rows = [
            variant(0, { actualHours: 56.083333333333336, actualHoursLabel: '56h 5m' }),
        ];
        render(<ProjectsList projects={rows} />);

        expect(screen.getByText(/56h 5m/)).toBeInTheDocument();
        expect(
            screen.queryByText(/56\.0833/),
        ).not.toBeInTheDocument();
    });

    it('heads the unled group "No lead" rather than leaving it blank', () => {
        render(<ProjectsList projects={[variant(0, { lead: null })]} />);
        expect(screen.getByText('No lead')).toBeInTheDocument();
    });

    it('says so when nobody is staffed, instead of showing an empty row', () => {
        render(<ProjectsList projects={[variant(0, { members: [] })]} />);
        expect(screen.getByText('Nobody staffed')).toBeInTheDocument();
    });

    it('says "Not set" for a project with no deadline', () => {
        render(
            <ProjectsList
                projects={[
                    variant(0, {
                        deadline: null,
                        deadlineLabel: null,
                        daysUntilDeadline: null,
                        isOverdue: false,
                    }),
                ]}
            />,
        );
        expect(screen.getByText('Not set')).toBeInTheDocument();
    });

    it('hides the countdown on a finished project', () => {
        // A completed project is not "12 days left": it is done. The countdown
        // is the field that keeps reading as live work after the fact.
        render(
            <ProjectsList
                projects={[
                    variant(0, {
                        isTerminal: true,
                        isOverdue: false,
                        daysUntilDeadline: -347,
                    }),
                ]}
            />,
        );
        expect(screen.queryByText(/overdue|left/)).not.toBeInTheDocument();
    });
});

describe('ProjectsBoard', () => {
    it('renders one column per lead and every project once', () => {
        render(<ProjectsBoard projects={PROJECT_ROWS} />);

        const leads = new Set(
            PROJECT_ROWS.map((project) => project.lead?.name ?? 'No lead'),
        );
        for (const lead of leads) {
            expect(screen.getAllByText(lead)).toHaveLength(1);
        }
        for (const project of PROJECT_ROWS) {
            expect(
                screen.getAllByRole('link', { name: project.name }),
            ).toHaveLength(1);
        }
    });

    it('shows the hours label on a card, not the float', () => {
        render(
            <ProjectsBoard
                projects={[
                    variant(0, {
                        actualHours: 21.5,
                        actualHoursLabel: '21h 30m',
                        estimatedHoursLabel: '119h 12m',
                    }),
                ]}
            />,
        );
        expect(screen.getByText(/21h 30m/)).toBeInTheDocument();
        expect(screen.getByText(/119h 12m/)).toBeInTheDocument();
    });

    it('omits the deadline footer on a finished project', () => {
        const finished = variant(0, {
            isTerminal: true,
            deadlineLabel: '347 days overdue',
        });
        render(<ProjectsBoard projects={[finished]} />);
        expect(
            screen.queryByText(/347 days overdue/),
        ).not.toBeInTheDocument();
    });

    it('states the deadline once, not twice in two wordings', () => {
        // It read "347 days overdue · 347d overdue": the API's phrasing plus
        // the same fact re-worded from `daysUntilDeadline` beside it.
        const overdue = variant(0, {
            isTerminal: false,
            isOverdue: true,
            daysUntilDeadline: -347,
            deadlineLabel: '347 days overdue',
        });
        render(<ProjectsBoard projects={[overdue]} />);

        expect(screen.getByText('347 days overdue')).toBeInTheDocument();
        expect(screen.queryByText(/347d/)).not.toBeInTheDocument();
    });

    it('shows the deadline footer on live work', () => {
        const live = variant(0, {
            isTerminal: false,
            deadlineLabel: 'in 12 days',
            isOverdue: false,
            daysUntilDeadline: 12,
        });
        render(<ProjectsBoard projects={[live]} />);
        expect(screen.getByText(/in 12 days/)).toBeInTheDocument();
    });
});

describe('ProjectsTimeline', () => {
    const renderTimeline = (
        projects: Project[],
        zoom: TimelineZoom = 'month',
    ) =>
        render(
            <ProjectsTimeline
                projects={projects}
                zoom={zoom}
                onZoomChange={vi.fn()}
                nowMs={NOW}
            />,
        );

    it('renders a row for every project', () => {
        renderTimeline(PROJECT_ROWS);
        for (const project of PROJECT_ROWS) {
            expect(
                screen.getAllByRole('link', { name: project.name }),
            ).toHaveLength(1);
        }
    });

    it('offers all four zoom levels, with the current one pressed', () => {
        renderTimeline(PROJECT_ROWS, 'week');

        const group = screen.getByRole('group', { name: 'Timeline zoom' });
        for (const label of ['Day', 'Week', 'Month', 'Quarter']) {
            expect(
                within(group).getByRole('button', { name: label }),
            ).toBeInTheDocument();
        }
        expect(
            within(group).getByRole('button', { name: 'Week' }),
        ).toHaveAttribute('aria-pressed', 'true');
        expect(
            within(group).getByRole('button', { name: 'Month' }),
        ).toHaveAttribute('aria-pressed', 'false');
    });

    it('reports the zoom the user picked', () => {
        const onZoomChange = vi.fn();
        render(
            <ProjectsTimeline
                projects={PROJECT_ROWS}
                zoom='month'
                onZoomChange={onZoomChange}
                nowMs={NOW}
            />,
        );

        screen.getByRole('button', { name: 'Quarter' }).click();
        // The VALUE, not merely that it was called: a switcher wired to the
        // wrong option is the bug this catches.
        expect(onZoomChange).toHaveBeenCalledWith('quarter');
    });

    it('changes the number of columns with the zoom', () => {
        const { container, unmount } = renderTimeline(PROJECT_ROWS, 'quarter');
        const quarterColumns = container.querySelectorAll(
            '[class*="tabular-nums"][class*="text-center"]',
        ).length;
        unmount();

        const day = renderTimeline(PROJECT_ROWS, 'day');
        const dayColumns = day.container.querySelectorAll(
            '[class*="tabular-nums"][class*="text-center"]',
        ).length;

        expect(dayColumns).toBeGreaterThan(quarterColumns);
    });

    it('says a project with no dates is not scheduled', () => {
        renderTimeline([
            variant(0, {
                plannedStartDate: null,
                deadline: null,
                deadlineLabel: null,
                daysUntilDeadline: null,
            }),
        ]);
        expect(screen.getByText('Not scheduled')).toBeInTheDocument();
    });

    it('describes a bar for a screen reader, not just visually', () => {
        const project = variant(0, {
            name: 'Readable project',
            deadlineLabel: 'in 12 days',
        });
        renderTimeline([project]);

        // A bar is a coloured div. Without this it conveys nothing to anyone
        // not looking at it.
        expect(
            screen.getByText(/Readable project · .* · in 12 days/),
        ).toBeInTheDocument();
    });

    it('marks a deadline with no planned start as unscheduled at the start', () => {
        renderTimeline([
            variant(0, { plannedStartDate: null, deadlineLabel: 'in 4 days' }),
        ]);
        expect(
            screen.getByText(/no planned start/),
        ).toBeInTheDocument();
    });

    it('groups its rows by lead, like the other two views', () => {
        renderTimeline([
            variant(0, { lead: null, name: 'Unled work' }),
            PROJECT_ROWS[1],
        ]);
        expect(screen.getByText('No lead')).toBeInTheDocument();
        expect(
            screen.getByText(PROJECT_ROWS[1].lead!.name),
        ).toBeInTheDocument();
    });
});
