import { describe, expect, it } from 'vitest';

import {
    buildTimelineScale,
    groupColumns,
    placeOnTimeline,
    type TimelineRange,
    type TimelineZoom,
} from '@/components/projects/timeline-scale';

/**
 * The arithmetic these cases pin is the kind that is wrong by an invisible
 * amount: a bar one column left of where it belongs still looks like a bar. So
 * the assertions are on exact boundaries and exact percentages, never on "looks
 * about right".
 */

// A Wednesday, chosen so the week alignment has a non-zero shift to correct.
const NOW = Date.UTC(2026, 7, 19);
const DAY_MS = 86_400_000;

const iso = (year: number, month: number, day: number) =>
    new Date(Date.UTC(year, month, day)).toISOString();

const scaleFor = (
    zoom: TimelineZoom,
    ranges: TimelineRange[] = [],
    nowMs = NOW,
) => buildTimelineScale({ zoom, ranges, nowMs });

describe('buildTimelineScale', () => {
    it('always contains today, even with no projects at all', () => {
        for (const zoom of ['day', 'week', 'month', 'quarter'] as const) {
            const scale = scaleFor(zoom);
            expect(scale.startMs).toBeLessThanOrEqual(NOW);
            expect(scale.endMs).toBeGreaterThan(NOW);
            expect(scale.todayPercent).not.toBeNull();
        }
    });

    it('honours the minimum column count so a sparse view is not two columns wide', () => {
        const minimums = { day: 21, week: 14, month: 12, quarter: 8 };
        for (const [zoom, minimum] of Object.entries(minimums)) {
            const scale = scaleFor(zoom as TimelineZoom);
            expect(scale.columns.length).toBeGreaterThanOrEqual(minimum);
        }
    });

    it('aligns the week window to a Monday', () => {
        // NOW is a Wednesday, so an unaligned window would start mid-week and
        // every week label would read as a meaningless date.
        const scale = scaleFor('week');
        expect(new Date(scale.startMs).getUTCDay()).toBe(1);
    });

    it('aligns the month window to the first of a month', () => {
        const scale = scaleFor('month');
        expect(new Date(scale.startMs).getUTCDate()).toBe(1);
    });

    it('aligns the quarter window to January, April, July or October', () => {
        const scale = scaleFor('quarter');
        const month = new Date(scale.startMs).getUTCMonth();
        expect([0, 3, 6, 9]).toContain(month);
    });

    it('gives month columns their real length rather than an equal share', () => {
        // February is shorter than March. Equal-width columns with time-based
        // bars drift further apart every month, so both must come from the same
        // measure.
        const scale = scaleFor('month', [
            { start: iso(2026, 0, 1), end: iso(2026, 11, 31) },
        ]);
        const february = scale.columns.find(
            (column) => new Date(column.startMs).getUTCMonth() === 1,
        );
        const march = scale.columns.find(
            (column) => new Date(column.startMs).getUTCMonth() === 2,
        );

        expect(february).toBeDefined();
        expect(march).toBeDefined();
        expect(february!.widthPercent).toBeLessThan(march!.widthPercent);
        expect(february!.endMs - february!.startMs).toBe(28 * DAY_MS);
        expect(march!.endMs - march!.startMs).toBe(31 * DAY_MS);
    });

    it('leaves no gap and no overlap between columns', () => {
        for (const zoom of ['day', 'week', 'month', 'quarter'] as const) {
            const scale = scaleFor(zoom, [
                { start: iso(2025, 10, 3), end: iso(2027, 2, 20) },
            ]);
            expect(scale.columns[0].startMs).toBe(scale.startMs);
            expect(scale.columns[scale.columns.length - 1].endMs).toBe(
                scale.endMs,
            );
            for (let index = 1; index < scale.columns.length; index += 1) {
                expect(scale.columns[index].startMs).toBe(
                    scale.columns[index - 1].endMs,
                );
            }
        }
    });

    it('sums the column widths to one hundred percent', () => {
        for (const zoom of ['day', 'week', 'month', 'quarter'] as const) {
            const total = scaleFor(zoom, [
                { start: iso(2026, 1, 2), end: iso(2026, 9, 9) },
            ]).columns.reduce((sum, column) => sum + column.widthPercent, 0);
            expect(total).toBeCloseTo(100, 6);
        }
    });

    it('widens the window to reach a project that starts before today', () => {
        const scale = scaleFor('month', [
            { start: iso(2025, 2, 10), end: iso(2025, 5, 30) },
        ]);
        expect(scale.startMs).toBeLessThanOrEqual(
            Date.UTC(2025, 2, 1),
        );
        // Today stays inside it even though all the work is in the past.
        expect(scale.endMs).toBeGreaterThan(NOW);
    });

    it('reaches past an inclusive deadline rather than stopping on it', () => {
        // A project ending on 31 December needs the window to include that whole
        // day, or its bar is clipped on the last day of its own life.
        const scale = scaleFor('day', [
            { start: iso(2026, 7, 19), end: iso(2026, 7, 31) },
        ]);
        expect(scale.endMs).toBeGreaterThan(Date.UTC(2026, 8, 1));
    });

    it('marks weekends at day zoom and nowhere else', () => {
        expect(scaleFor('day').columns.some((c) => c.isWeekend)).toBe(true);
        for (const zoom of ['week', 'month', 'quarter'] as const) {
            expect(scaleFor(zoom).columns.every((c) => !c.isWeekend)).toBe(true);
        }
    });

    it('places the today marker proportionally, not at the first column', () => {
        const scale = scaleFor('day');
        expect(scale.todayPercent!).toBeGreaterThan(0);
        expect(scale.todayPercent!).toBeLessThan(100);
    });

    it('ignores an unparseable date instead of producing a window of NaN', () => {
        const scale = scaleFor('month', [
            { start: 'not a date', end: iso(2026, 8, 1) },
        ]);
        expect(Number.isFinite(scale.startMs)).toBe(true);
        expect(Number.isFinite(scale.endMs)).toBe(true);
    });
});

describe('placeOnTimeline', () => {
    const scale = scaleFor('day', [
        { start: iso(2026, 7, 19), end: iso(2026, 8, 10) },
    ]);

    it('returns null when a project has neither date', () => {
        expect(placeOnTimeline(scale, { start: null, end: null })).toBeNull();
    });

    it('gives a one-day project a full day of width, not zero', () => {
        // The deadline is the last day of work, not the moment before it starts.
        const placement = placeOnTimeline(scale, {
            start: iso(2026, 7, 20),
            end: iso(2026, 7, 20),
        });
        const dayPercent = (DAY_MS / (scale.endMs - scale.startMs)) * 100;
        expect(placement!.widthPercent).toBeCloseTo(dayPercent, 6);
    });

    it('spans the inclusive range', () => {
        const placement = placeOnTimeline(scale, {
            start: iso(2026, 7, 20),
            end: iso(2026, 7, 24),
        });
        const fiveDays = (5 * DAY_MS / (scale.endMs - scale.startMs)) * 100;
        expect(placement!.widthPercent).toBeCloseTo(fiveDays, 6);
    });

    it('renders a deadline with no start as a milestone rather than guessing', () => {
        const placement = placeOnTimeline(scale, {
            start: null,
            end: iso(2026, 7, 25),
        });
        expect(placement!.isMilestone).toBe(true);
        expect(placement!.widthPercent).toBeCloseTo(
            (DAY_MS / (scale.endMs - scale.startMs)) * 100,
            6,
        );
    });

    it('draws a start with no deadline as open ended, not as one day', () => {
        // Nobody agreed an end date. A one-day bar would assert a schedule, so
        // it runs to the frame with the open right edge Gantt convention uses.
        const placement = placeOnTimeline(scale, {
            start: iso(2026, 7, 21),
            end: null,
        })!;

        expect(placement.isMilestone).toBe(false);
        expect(placement.isOpenEnded).toBe(true);
        // Not `clippedEnd`: nothing was cut off, there is nothing to cut.
        expect(placement.clippedEnd).toBe(false);
        expect(placement.leftPercent + placement.widthPercent).toBeCloseTo(
            100,
            6,
        );
    });

    it('clips a bar at the window edge and flags which end was cut', () => {
        const narrow = scaleFor('day', [
            { start: iso(2026, 7, 18), end: iso(2026, 7, 20) },
        ]);
        const placement = placeOnTimeline(narrow, {
            start: new Date(narrow.startMs - 30 * DAY_MS).toISOString(),
            end: new Date(narrow.endMs + 30 * DAY_MS).toISOString(),
        })!;

        expect(placement.clippedStart).toBe(true);
        expect(placement.clippedEnd).toBe(true);
        expect(placement.isOpenEnded).toBe(false);
        expect(placement.leftPercent).toBe(0);
        expect(placement.widthPercent).toBeCloseTo(100, 6);
    });

    it('never lets a bar start left of the frame or run past its right', () => {
        const placement = placeOnTimeline(scale, {
            start: iso(2026, 7, 19),
            end: iso(2026, 8, 10),
        })!;
        expect(placement.leftPercent).toBeGreaterThanOrEqual(0);
        expect(placement.leftPercent + placement.widthPercent).toBeLessThanOrEqual(
            100.000001,
        );
    });

    it('returns null for a range that falls entirely outside the window', () => {
        const placement = placeOnTimeline(scale, {
            start: new Date(scale.endMs + DAY_MS).toISOString(),
            end: new Date(scale.endMs + 5 * DAY_MS).toISOString(),
        });
        expect(placement).toBeNull();
    });

    it('clamps a milestone that sits beyond the window into it', () => {
        const placement = placeOnTimeline(scale, {
            start: null,
            end: new Date(scale.endMs + 90 * DAY_MS).toISOString(),
        })!;
        expect(placement.leftPercent).toBeLessThan(100);
        expect(placement.leftPercent).toBeGreaterThanOrEqual(0);
    });
});

describe('groupColumns', () => {
    it('merges adjacent columns that share a band', () => {
        const scale = scaleFor('day', [
            { start: iso(2026, 7, 1), end: iso(2026, 9, 30) },
        ]);
        const bands = groupColumns(scale.columns);

        // Far fewer bands than day columns, because a month spans many days.
        expect(bands.length).toBeLessThan(scale.columns.length);
        expect(new Set(bands.map((band) => band.label)).size).toBe(
            bands.length,
        );
    });

    it('keeps the total width intact when merging', () => {
        const scale = scaleFor('month', [
            { start: iso(2025, 5, 1), end: iso(2027, 5, 1) },
        ]);
        const total = groupColumns(scale.columns).reduce(
            (sum, band) => sum + band.widthPercent,
            0,
        );
        expect(total).toBeCloseTo(100, 6);
    });

    it('returns nothing for no columns', () => {
        expect(groupColumns([])).toEqual([]);
    });
});

describe('minWidthPx', () => {
    it('grows with the number of columns rather than being fixed', () => {
        // The defect it closes: the axis was squeezed into the viewport, so at
        // day zoom over a year every label truncated to one character.
        const narrow = scaleFor('day');
        const wide = scaleFor('day', [
            { start: iso(2025, 0, 1), end: iso(2026, 11, 31) },
        ]);

        expect(wide.columns.length).toBeGreaterThan(narrow.columns.length);
        expect(wide.minWidthPx).toBeGreaterThan(narrow.minWidthPx);
    });

    it('gives every column at least enough room for its own label', () => {
        for (const zoom of ['day', 'week', 'month', 'quarter'] as const) {
            const scale = scaleFor(zoom, [
                { start: iso(2025, 0, 1), end: iso(2026, 11, 31) },
            ]);
            const perColumn = scale.minWidthPx / scale.columns.length;
            // "S 14" is the shortest label any zoom draws.
            expect(perColumn).toBeGreaterThanOrEqual(30);
        }
    });

    it('makes a two-year day axis far wider than one screen', () => {
        const scale = scaleFor('day', [
            { start: iso(2025, 0, 1), end: iso(2026, 11, 31) },
        ]);
        expect(scale.minWidthPx).toBeGreaterThan(4000);
    });
});
