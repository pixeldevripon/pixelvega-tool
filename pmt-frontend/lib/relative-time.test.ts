import { describe, expect, it } from 'vitest';

import { relativeTime } from './relative-time';

// `now` is pinned so nothing here depends on when the suite runs.
const NOW = new Date('2026-08-20T12:00:00.000Z');

const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('relativeTime', () => {
    it('says "just now" under a minute', () => {
        expect(relativeTime(ago(30 * 1000), NOW)).toBe('just now');
    });

    it('reports a future timestamp as "just now" rather than "in 3 seconds"', () => {
        // A row created a moment ago routinely arrives a second in the future
        // because the server's clock and the browser's disagree. "in 3 seconds"
        // on something that already happened reads as a bug.
        const soon = new Date(NOW.getTime() + 3000).toISOString();
        expect(relativeTime(soon, NOW)).toBe('just now');
    });

    it('picks minutes, then hours, then days', () => {
        expect(relativeTime(ago(3 * MINUTE), NOW)).toBe('3 minutes ago');
        expect(relativeTime(ago(5 * HOUR), NOW)).toBe('5 hours ago');
        expect(relativeTime(ago(3 * DAY), NOW)).toBe('3 days ago');
    });

    it('rolls 90 minutes up to the larger unit', () => {
        // Largest unit first is the whole reason UNITS is ordered: "90 minutes
        // ago" is technically right and nobody reads a meta line that way.
        expect(relativeTime(ago(90 * MINUTE), NOW)).toBe('1 hour ago');
    });

    it('uses the calendar word where Intl has one', () => {
        // `numeric: 'auto'` is what buys these. "yesterday" beats "1 day ago"
        // in a meta line, and it costs nothing.
        expect(relativeTime(ago(DAY), NOW)).toBe('yesterday');
        expect(relativeTime(ago(10 * DAY), NOW)).toBe('last week');
        expect(relativeTime(ago(400 * DAY), NOW)).toBe('last year');
    });

    it('reaches months', () => {
        expect(relativeTime(ago(70 * DAY), NOW)).toBe('2 months ago');
    });

    it('returns an empty string for nothing and for rubbish', () => {
        expect(relativeTime(null, NOW)).toBe('');
        expect(relativeTime(undefined, NOW)).toBe('');
        expect(relativeTime('', NOW)).toBe('');
        expect(relativeTime('not a date', NOW)).toBe('');
    });

    it('accepts a Date as well as an ISO string', () => {
        expect(relativeTime(new Date(NOW.getTime() - 2 * HOUR), NOW)).toBe(
            '2 hours ago',
        );
    });
});
