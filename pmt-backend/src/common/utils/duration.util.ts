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

/**
 * Decimal hours as a readable duration, for the hours columns that are stored
 * that way rather than as minutes.
 *
 * It exists so `Math.round(hours * 60)` is not written at every call site. That
 * conversion looks harmless and is not: writing it by hand in one mapper and
 * forgetting it in the next is exactly how `56.083333333333336h` reached a
 * screen. One definition of how a duration reads (D4).
 */
export function formatHoursLabel(
  hours: number | null | undefined,
): string | null {
  if (hours === null || hours === undefined) return null;
  return formatDuration(Math.round(hours * 60));
}

/**
 * Whole days until a deadline, as the phrase a person would say.
 *
 * Lives here rather than in a module because the projects list, the dashboard
 * and any future board all show the same countdown, and two of them phrasing it
 * differently is the class of difference nobody notices until a client does.
 *
 * Takes days already computed against the server clock. It must never derive
 * them from `new Date()`: the whole point of `daysUntilDeadline` being a
 * response field is that one clock decides, and a formatter reaching for a
 * second one would put the boundary case ("due today") a day out for anyone in
 * a different timezone.
 */
export function formatDeadlineLabel(days: number | null): string | null {
  if (days === null) return null;
  if (days === 0) return 'due today';
  if (days === 1) return 'due tomorrow';
  if (days === -1) return '1 day overdue';
  if (days < 0) return `${Math.abs(days)} days overdue`;
  return `in ${days} days`;
}
