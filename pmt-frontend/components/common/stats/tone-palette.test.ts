import { describe, expect, it } from 'vitest';

import { toneFill, toneSwatch, TRACK_FILL } from './tone-palette';

/**
 * The one place a tone becomes a chart colour, so this is where the two forms
 * are pinned to each other. A ring and the legend beside it are painted by
 * different machinery, and the defect they can produce is being different
 * colours for the same tone.
 */
describe('tone-palette', () => {
    const TONES = ['default', 'primary', 'success', 'warning', 'danger'];

    it.each(TONES)('gives %s both an SVG fill and a swatch class', (tone) => {
        expect(toneFill(tone)).toMatch(/^var\(--color-[a-z-]+\)$/);
        expect(toneSwatch(tone)).toMatch(/^bg-[a-z-]+$/);
    });

    it.each(TONES)(
        'names the same token in both forms for %s',
        (tone) => {
            // `var(--color-success-solid)` and `bg-success-solid` must agree, or
            // a donut slice and its own legend dot are two different colours.
            const token = toneFill(tone).replace(/^var\(--color-|\)$/g, '');
            expect(toneSwatch(tone)).toBe(`bg-${token}`);
        },
    );

    it('falls back to neutral for a tone the server grew first', () => {
        // The client must never break on an API that moved forward, and a chart
        // with no colour at all is a break.
        expect(toneFill('some-new-tone')).toBe(toneFill('default'));
        expect(toneSwatch('some-new-tone')).toBe(toneSwatch('default'));
    });

    it('gives the gauge track a SURFACE token, not a text colour', () => {
        // The bug this closed: the track was drawn in the neutral tone, which
        // is `content-subtle`, a text colour. A gauge at 0% came out charcoal.
        expect(TRACK_FILL).toBe('var(--color-surface-inset)');
        expect(TRACK_FILL).not.toBe(toneFill('default'));
    });

    it('keeps the track out of the five tones entirely', () => {
        // It is not a sixth tone: it carries no meaning, which is the point.
        expect(TONES.map(toneFill)).not.toContain(TRACK_FILL);
    });
});
