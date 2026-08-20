/**
 * "3 minutes ago" for the timestamps the API sends.
 *
 * This is formatting, not derivation: `Intl` output is a locale preference, the
 * same exemption `formatDate` in `lib/utils.ts` already relies on (D4 allows
 * `Intl` date and number formatting, and nothing else). It decides nothing about
 * the business, and it neither reorders nor filters a list.
 *
 * The API sends ISO strings. A null or unparseable one returns an empty string
 * rather than "Invalid Date", because this lands in a meta line where a wrong
 * word is worse than no word.
 */

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** Largest unit first, so 90 minutes reads as "1 hour ago" rather than "90 minutes ago". */
const UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
    { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
    { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
    { unit: 'week', ms: 7 * 24 * 60 * 60 * 1000 },
    { unit: 'day', ms: 24 * 60 * 60 * 1000 },
    { unit: 'hour', ms: 60 * 60 * 1000 },
    { unit: 'minute', ms: 60 * 1000 },
];

function toDate(value: string | Date | null | undefined): Date | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * "3 minutes ago", "yesterday", "2 months ago".
 *
 * `now` is a parameter so a test can pin it. Callers pass nothing.
 */
export function relativeTime(
    value: string | Date | null | undefined,
    now: Date = new Date(),
): string {
    const date = toDate(value);
    if (!date) return '';

    const elapsed = date.getTime() - now.getTime();
    const magnitude = Math.abs(elapsed);

    // Under a minute is "just now" rather than "in 0 seconds": a fresh row's
    // clock skew against the server routinely puts it a second in the future,
    // and "in 3 seconds" on something that already happened reads as a bug.
    if (magnitude < 60 * 1000) return 'just now';

    for (const { unit, ms } of UNITS) {
        if (magnitude >= ms) {
            return relative.format(Math.round(elapsed / ms), unit);
        }
    }
    return 'just now';
}
