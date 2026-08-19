/**
 * Minutes as a readable duration: `7h 30m`, `7h` on the hour, `45m` under one.
 *
 * On the server under D4's test. The frontend had six copies of this and they
 * disagreed: two dropped a zero minute remainder ("7h"), two kept it ("7h 0m"),
 * and two appended "avg." to the same arithmetic. One definition, and the
 * caller that wants a suffix adds it.
 *
 * Exact decomposition, never rounding, so nothing is lost. The exact minute
 * count still rides alongside in every response (ADR 0003), and this string is
 * for reading only.
 */
export function formatDuration(
  minutes: number | null | undefined,
): string | null {
  if (minutes === null || minutes === undefined) return null;

  const negative = minutes < 0;
  const total = Math.abs(minutes);
  const hours = Math.floor(total / 60);
  const remainder = total % 60;

  const text = !hours
    ? `${remainder}m`
    : remainder
      ? `${hours}h ${remainder}m`
      : `${hours}h`;

  return negative ? `-${text}` : text;
}

/**
 * Minutes as decimal hours, rounded to two places.
 *
 * The one place that rounding happens, so every hours figure in the API agrees
 * (ADR 0003). Sum minutes and round once; never sum values that have been
 * through here.
 */
export function toHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}
