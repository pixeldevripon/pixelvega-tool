/**
 * The geometry behind the projects timeline. Pure, and deliberately unaware of
 * React, so the arithmetic that decides where a bar sits can be tested without
 * rendering anything.
 *
 * ── Why this is allowed to compute, when D4 says the frontend does not ──
 *
 * D4 is about business rules: two clients must not each decide what "overdue"
 * means. This is neither a rule nor a value: it is where a pixel goes, given a
 * viewport, a zoom level and dates the backend already decided. A native app
 * with a different screen width would need different numbers from the same
 * facts, which is the test D4 sets. It is the same reason `Intl` date formatting
 * is allowed here and a deadline countdown is not.
 *
 * Every date is handled in UTC. Local-time month arithmetic changes length twice
 * a year, and an hour of drift is enough to put a bar in the wrong column.
 *
 * ── Why columns carry their real span rather than sharing the width evenly ──
 *
 * February and March are not the same length. If bars are positioned by elapsed
 * time but columns are drawn at equal widths, every bar after February sits
 * slightly left of the grid line it should touch, and the error accumulates
 * across a year. Both the grid and the bars are therefore driven from one
 * measure: milliseconds as a share of the window.
 */

export type TimelineZoom = 'day' | 'week' | 'month' | 'quarter';

export const TIMELINE_ZOOMS: { value: TimelineZoom; label: string }[] = [
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'quarter', label: 'Quarter' },
];

export type TimelineColumn = {
    key: string;
    /** The column's own tick label: "14", "Mar", "Q2". */
    label: string;
    /** The band above it, which repeats across the columns it spans. */
    group: string;
    startMs: number;
    endMs: number;
    /** Its share of the window, as a percentage. Drives the grid template. */
    widthPercent: number;
    /** Saturday or Sunday, at day zoom only. Shaded, not hidden. */
    isWeekend: boolean;
};

export type TimelineScale = {
    zoom: TimelineZoom;
    startMs: number;
    endMs: number;
    columns: TimelineColumn[];
    /** Where "now" falls, or null when it is outside the window. */
    todayPercent: number | null;
    /**
     * How wide the canvas has to be for every column to stay legible. The
     * container scrolls past this; the percentages resolve against it.
     */
    minWidthPx: number;
};

export type TimelinePlacement = {
    leftPercent: number;
    widthPercent: number;
    /**
     * The bar ran past the window and was cut there, so its edge is an artefact
     * of the viewport. Scrolling or zooming out would reveal more.
     */
    clippedStart: boolean;
    clippedEnd: boolean;
    /**
     * No deadline was ever set, so the bar has no end to cut. Distinct from
     * `clippedEnd`, which is a viewport artefact: this one is a fact about the
     * project, and zooming out will not resolve it.
     */
    isOpenEnded: boolean;
    /**
     * Only a deadline is known, so there is no span to draw. Rendered as a
     * marker on that date rather than as a bar guessing where work began.
     */
    isMilestone: boolean;
};

export type TimelineRange = {
    /** ISO date, or null. */
    start: string | null;
    /** ISO date, or null. Treated as inclusive: work happens ON the deadline. */
    end: string | null;
};

const DAY_MS = 86_400_000;

/**
 * The narrowest window each zoom will draw, in columns.
 *
 * Without a floor, one short project produces a two-column axis, and the view
 * reads as broken rather than as sparse.
 */
const MINIMUM_COLUMNS: Record<TimelineZoom, number> = {
    day: 21,
    week: 14,
    month: 12,
    quarter: 8,
};

/**
 * The narrowest a column may be drawn, in pixels, per zoom.
 *
 * Without a floor the whole axis is squeezed into the viewport, and at day zoom
 * over a year of projects that is four hundred columns in twelve hundred pixels:
 * every label truncates to a single character and the view is unreadable at
 * exactly the zoom someone chose for detail. With it the canvas grows past the
 * frame and scrolls, which is what a Gantt is supposed to do.
 *
 * Each value is roughly the width its own label needs: "S 14" at day zoom,
 * "14 Mar" at week, "Mar" at month, "Q2" at quarter.
 */
const MINIMUM_COLUMN_PX: Record<TimelineZoom, number> = {
    day: 34,
    week: 58,
    month: 72,
    quarter: 88,
};

// ═══ Building the scale ═══

export function buildTimelineScale({
    zoom,
    ranges,
    nowMs,
}: {
    zoom: TimelineZoom;
    ranges: TimelineRange[];
    nowMs: number;
}): TimelineScale {
    const { startMs, endMs } = windowFor(zoom, ranges, nowMs);

    const totalMs = endMs - startMs;
    const columns: TimelineColumn[] = [];

    for (let cursor = startMs; cursor < endMs; ) {
        const next = Math.min(advance(zoom, cursor), endMs);
        columns.push({
            key: String(cursor),
            label: columnLabel(zoom, cursor),
            group: groupLabel(zoom, cursor),
            startMs: cursor,
            endMs: next,
            widthPercent: ((next - cursor) / totalMs) * 100,
            isWeekend: zoom === 'day' && isWeekendDay(cursor),
        });
        cursor = next;
    }

    const withinWindow = nowMs >= startMs && nowMs < endMs;

    return {
        zoom,
        startMs,
        endMs,
        columns,
        todayPercent: withinWindow
            ? ((nowMs - startMs) / totalMs) * 100
            : null,
        minWidthPx: columns.length * MINIMUM_COLUMN_PX[zoom],
    };
}

/**
 * The window the axis covers: everything the data touches, plus today, snapped
 * out to whole columns and widened by one column at each end so a bar never
 * starts flush against the frame.
 *
 * Today is always inside it. A timeline that has scrolled off the present is
 * the one view of a project list nobody wants.
 */
function windowFor(
    zoom: TimelineZoom,
    ranges: TimelineRange[],
    nowMs: number,
): { startMs: number; endMs: number } {
    let earliest = nowMs;
    let latest = nowMs;

    for (const range of ranges) {
        const start = parseUtcDate(range.start);
        const end = parseUtcDate(range.end);
        for (const point of [start, end]) {
            if (point === null) continue;
            if (point < earliest) earliest = point;
            if (point > latest) latest = point;
        }
    }

    const startMs = alignBack(zoom, earliest, 1);

    // The deadline day is inclusive, so the window must reach past its end
    // before the padding column is added.
    let endMs = advance(zoom, alignDown(zoom, latest + DAY_MS));

    let columnCount = countColumns(zoom, startMs, endMs);
    while (columnCount < MINIMUM_COLUMNS[zoom]) {
        endMs = advance(zoom, endMs);
        columnCount += 1;
    }

    return { startMs, endMs };
}

function countColumns(zoom: TimelineZoom, startMs: number, endMs: number) {
    let count = 0;
    for (let cursor = startMs; cursor < endMs; cursor = advance(zoom, cursor)) {
        count += 1;
    }
    return count;
}

// ═══ Placing one project ═══

/**
 * Where one project's bar sits inside the scale, or null when it has no dates
 * at all.
 *
 * A project with a deadline and no planned start is a real and common state:
 * something is due, and nobody has said when it begins. It becomes a milestone
 * marker rather than a bar, because a bar would have to invent a start date and
 * would then be read as a plan.
 */
export function placeOnTimeline(
    scale: TimelineScale,
    range: TimelineRange,
): TimelinePlacement | null {
    const totalMs = scale.endMs - scale.startMs;
    const start = parseUtcDate(range.start);
    const end = parseUtcDate(range.end);

    if (start === null && end === null) return null;

    if (start === null) {
        // Sits ON the deadline day, occupying it and nothing more.
        const dayStart = clamp(end as number, scale.startMs, scale.endMs - 1);
        return {
            leftPercent: ((dayStart - scale.startMs) / totalMs) * 100,
            widthPercent: (DAY_MS / totalMs) * 100,
            clippedStart: false,
            clippedEnd: false,
            isOpenEnded: false,
            isMilestone: true,
        };
    }

    // Two adjustments, both about not drawing a claim the data does not make.
    //
    // The deadline is inclusive, so a project that starts and ends on one day
    // still has a day of width. Without the `+ DAY_MS` it renders as nothing.
    //
    // A start with NO deadline is open ended, and the honest drawing of that
    // runs to the edge of the frame with `clippedEnd` set, which is the frayed
    // right edge every Gantt uses for it. Giving it a single day instead would
    // read as "this takes a day", which is a schedule nobody agreed to.
    const rawEnd = end === null ? scale.endMs : end + DAY_MS;

    const visibleStart = Math.max(start, scale.startMs);
    const visibleEnd = Math.min(rawEnd, scale.endMs);

    if (visibleEnd <= visibleStart) return null;

    return {
        leftPercent: ((visibleStart - scale.startMs) / totalMs) * 100,
        widthPercent: ((visibleEnd - visibleStart) / totalMs) * 100,
        clippedStart: start < scale.startMs,
        clippedEnd: rawEnd > scale.endMs,
        isOpenEnded: end === null,
        isMilestone: false,
    };
}

// ═══ UTC date arithmetic ═══

/**
 * The start of the UTC day an ISO date names, or null.
 *
 * The API sends either a date-only string or a full timestamp, and both are
 * truncated to the day: a timeline column is a day at its finest, so the hour a
 * deadline was recorded at carries no meaning here.
 */
function parseUtcDate(value: string | null): number | null {
    if (!value) return null;
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) return null;
    return startOfUtcDay(parsed);
}

function startOfUtcDay(ms: number) {
    const date = new Date(ms);
    return Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
    );
}

function alignDown(zoom: TimelineZoom, ms: number): number {
    const date = new Date(startOfUtcDay(ms));
    switch (zoom) {
        case 'day':
            return date.getTime();
        case 'week': {
            // ISO weeks start on Monday; getUTCDay() calls Sunday 0.
            const shift = (date.getUTCDay() + 6) % 7;
            return date.getTime() - shift * DAY_MS;
        }
        case 'month':
            return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
        case 'quarter':
            return Date.UTC(
                date.getUTCFullYear(),
                Math.floor(date.getUTCMonth() / 3) * 3,
                1,
            );
    }
}

/** Align down, then step back `columns` whole columns. */
function alignBack(zoom: TimelineZoom, ms: number, columns: number): number {
    let cursor = alignDown(zoom, ms);
    for (let index = 0; index < columns; index += 1) {
        cursor = retreat(zoom, cursor);
    }
    return cursor;
}

function advance(zoom: TimelineZoom, ms: number): number {
    const date = new Date(ms);
    switch (zoom) {
        case 'day':
            return ms + DAY_MS;
        case 'week':
            return ms + 7 * DAY_MS;
        case 'month':
            return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
        case 'quarter':
            return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 3, 1);
    }
}

function retreat(zoom: TimelineZoom, ms: number): number {
    const date = new Date(ms);
    switch (zoom) {
        case 'day':
            return ms - DAY_MS;
        case 'week':
            return ms - 7 * DAY_MS;
        case 'month':
            return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1);
        case 'quarter':
            return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 3, 1);
    }
}

function isWeekendDay(ms: number) {
    const day = new Date(ms).getUTCDay();
    return day === 0 || day === 6;
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

// ═══ Labels ═══

/**
 * Formatters are built once. `Intl.DateTimeFormat` construction is the expensive
 * part, and a year of day columns would otherwise build hundreds per render.
 *
 * `timeZone: 'UTC'` is required, not cosmetic: the arithmetic above is UTC, so a
 * local-time formatter would label the boundary column with the previous day
 * for anyone west of Greenwich.
 */
const DAY_LABEL = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    timeZone: 'UTC',
});
const DAY_OF_WEEK = new Intl.DateTimeFormat(undefined, {
    weekday: 'narrow',
    timeZone: 'UTC',
});
const SHORT_MONTH = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    timeZone: 'UTC',
});
const MONTH_AND_YEAR = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
});
const DAY_AND_MONTH = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
});

function columnLabel(zoom: TimelineZoom, ms: number): string {
    const date = new Date(ms);
    switch (zoom) {
        case 'day':
            return `${DAY_OF_WEEK.format(date)} ${DAY_LABEL.format(date)}`;
        case 'week':
            return DAY_AND_MONTH.format(date);
        case 'month':
            return SHORT_MONTH.format(date);
        case 'quarter':
            return `Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
    }
}

function groupLabel(zoom: TimelineZoom, ms: number): string {
    const date = new Date(ms);
    switch (zoom) {
        case 'day':
        case 'week':
            return MONTH_AND_YEAR.format(date);
        case 'month':
        case 'quarter':
            return String(date.getUTCFullYear());
    }
}

/**
 * Adjacent columns that share a group, so the band above the axis spans them
 * instead of repeating the same month once per day.
 */
export function groupColumns(columns: TimelineColumn[]) {
    const bands: { key: string; label: string; widthPercent: number }[] = [];

    for (const column of columns) {
        const last = bands[bands.length - 1];
        if (last && last.label === column.group) {
            last.widthPercent += column.widthPercent;
            continue;
        }
        bands.push({
            key: column.key,
            label: column.group,
            widthPercent: column.widthPercent,
        });
    }

    return bands;
}
