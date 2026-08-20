/**
 * Display formatting. The one place a value becomes text for a human.
 *
 * These stay in the client on purpose (ADR 0003 and directive D4): they are
 * locale presentation, not business rules, and a server formatting dates would
 * have to guess the viewer's timezone and locale, and would guess wrong.
 *
 * The rule that keeps them honest: **nothing here may feed a calculation.**
 * Formatting is the last step. Never parse one of these strings back, and never
 * sum values that have already been rounded for display. Where a number is
 * compared or totalled, use the exact value the API sent (`totalMinutes`, not
 * `totalHours`).
 *
 * Before this module these functions were declared in twenty different files
 * with subtly different fallback copy. That copy is now an explicit argument
 * rather than something baked into whichever copy you happened to call.
 */

/** Absent-value text. Call sites differ, so it is always explicit. */
const DEFAULT_EMPTY = "Not set";

/** Anything the API might hand us for a moment in time. */
type DateInput = string | number | Date | null | undefined;

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * A calendar date carries no timezone, so it must not be rendered in one.
 * Pinned to UTC on both sides: parsed as UTC midnight, formatted as UTC.
 */
const dateOnlyFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeZone: "UTC",
});

/** `12 Aug 2026`. For an instant: something that happened at a point in time. */
export function formatDate(value?: DateInput, empty = DEFAULT_EMPTY) {
  if (!value) return empty;
  return dateFormatter.format(new Date(value));
}

/** `12 Aug 2026, 14:32`. */
export function formatDateTime(value?: DateInput, empty = DEFAULT_EMPTY) {
  if (!value) return empty;
  return dateTimeFormatter.format(new Date(value));
}

/**
 * `12 Aug 2026` for a **calendar date**: a leave day, a report date, a deadline.
 *
 * Use this, not `formatDate`, whenever the value is a day rather than a moment.
 * `new Date("2026-08-12")` parses as UTC midnight, so rendering it in any
 * timezone behind UTC shows the day before. A viewer in New York would see a
 * report filed on the 12th dated the 11th. Pinning both ends to UTC is what
 * stops that, and it is why this is a separate function rather than a flag.
 */
export function formatDateOnly(value?: DateInput, empty = DEFAULT_EMPTY) {
  if (!value) return empty;
  const iso = typeof value === "string" ? value.slice(0, 10) : toIsoDay(value);
  return dateOnlyFormatter.format(new Date(`${iso}T00:00:00Z`));
}

function toIsoDay(value: number | Date) {
  return new Date(value).toISOString().slice(0, 10);
}

/**
 * `7h 30m`, `7h` on the hour, `45m` under one.
 *
 * Exact decomposition, not rounding: the minutes are split, never approximated,
 * so this loses nothing. Takes MINUTES, which is what the API sends as the exact
 * value.
 */
export function formatMinutes(value?: number | null, empty = DEFAULT_EMPTY) {
  if (value === null || value === undefined) return empty;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (!hours) return `${minutes}m`;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

/**
 * `12h` or `12.25h`.
 *
 * This one DOES round, to two decimal places, matching the precision the server
 * uses for derived hour figures. Display only: if a total is needed, sum the
 * exact minutes and let the server round once, rather than summing values that
 * have already been through here (ADR 0003).
 */
export function formatHours(value?: number | null, empty = DEFAULT_EMPTY) {
  if (value === null || value === undefined) return empty;
  return `${value.toFixed(value % 1 === 0 ? 0 : 2)}h`;
}

/** `1.2 MB`. Binary units, since that is what a file manager shows. */
export function formatFileSize(bytes?: number | null, empty = DEFAULT_EMPTY) {
  if (bytes === null || bytes === undefined) return empty;
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size % 1 === 0 ? 0 : 1)} ${units[unit]}`;
}

/**
 * Turn `READY_FOR_WORK` into `Ready For Work`.
 *
 * TEMPORARY. Directive D4 and ADR 0001 move this to the server: every enum in a
 * response becomes `{ value, label, tone }`, because deciding how a status reads
 * is vocabulary the server owns and two clients must not be free to disagree
 * about it.
 *
 * Kept here only so the copies scattered through components can be deleted now
 * rather than waiting for the API change. It reproduces those copies exactly,
 * title casing included, so that consolidating them changes no pixels. That
 * fidelity preserves a real flaw: `AI_SUMMARY` renders as `Ai Summary`. Fixing
 * it here would only move the guess, so it is left for the server label that
 * replaces this function.
 */
export function formatEnumLabel(value?: string | null, empty = DEFAULT_EMPTY) {
  if (!value) return empty;
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
