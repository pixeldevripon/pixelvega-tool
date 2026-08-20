import { toneToVariant } from '@/components/common/enum-badge';
import type { StatusVariant } from '@/components/common/status-badge';

/**
 * The one place a tone becomes a chart colour.
 *
 * ── Why each row carries both a class and a CSS value ──
 *
 * A donut and the legend beside it must be the same purple, and they are painted
 * by different machinery: the legend dot is a `<span>` that takes a Tailwind
 * class, and a recharts `<Cell>` takes a `fill` string. Two separate maps is
 * exactly how a ring and its own legend end up disagreeing, so both forms sit on
 * one row and are edited together.
 *
 * The class strings are literals rather than built from a token name, because
 * Tailwind extracts classes statically and a composed `bg-${x}` produces nothing.
 *
 * The colours themselves are `enum-badge`'s five tones, resolved through the same
 * `toneToVariant`, so a chart cannot invent a sixth or read a tone differently
 * from the badge sitting next to it.
 */

type ChartTone = {
    /** For an SVG `fill` attribute: recharts wants a value, not a class. */
    fill: string;
    /** For a `<div>` or `<span>` swatch. */
    swatch: string;
};

const PALETTE: Record<StatusVariant, ChartTone> = {
    // `primary` (the brand purple) rather than `info-solid` for the info tone:
    // a status that is merely current should read as the product's own colour,
    // and the blue is reserved for genuinely informational surfaces.
    neutral: { fill: 'var(--color-content-subtle)', swatch: 'bg-content-subtle' },
    info: { fill: 'var(--color-primary)', swatch: 'bg-primary' },
    success: {
        fill: 'var(--color-success-solid)',
        swatch: 'bg-success-solid',
    },
    warning: {
        fill: 'var(--color-warning-solid)',
        swatch: 'bg-warning-solid',
    },
    danger: { fill: 'var(--color-danger-solid)', swatch: 'bg-danger-solid' },
};

/**
 * The unmeasured remainder of a gauge.
 *
 * Not a sixth tone: it carries no meaning at all, which is exactly the point. A
 * gauge is one measured arc plus the rest of the ring, and drawing that rest in
 * the neutral tone paints it in `content-subtle`, which is a TEXT colour. At
 * 0% filed the whole ring came out charcoal and read as a heavy blob rather
 * than as an empty gauge.
 */
export const TRACK_FILL = 'var(--color-surface-inset)';

/** The tone as an SVG fill value, for a recharts `<Cell>`. */
export function toneFill(tone: string): string {
    return PALETTE[toneToVariant(tone)].fill;
}

/** The tone as a background class, for a legend dot or a bar segment. */
export function toneSwatch(tone: string): string {
    return PALETTE[toneToVariant(tone)].swatch;
}
