/**
 * Bytes as a human readable size.
 *
 * Lives on the server under D4's test: two clients would otherwise each
 * implement the same binary unit arithmetic, and would disagree about it. The
 * frontend's copy had no gigabyte tier at all, so a 2 GB deliverable rendered
 * as "2048.0 MB".
 *
 * The exact byte count still rides alongside in the response (ADR 0003). This
 * string is for reading, never for arithmetic.
 */
const UNITS = ['KB', 'MB', 'GB', 'TB'] as const;

export function formatFileSize(
  bytes: number | null | undefined,
): string | null {
  if (bytes === null || bytes === undefined) return null;
  if (bytes < 1024) return `${bytes} B`;

  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < UNITS.length - 1) {
    size /= 1024;
    unit += 1;
  }
  // A whole number reads better without a trailing ".0", and one decimal is
  // enough precision for a size nobody is going to do arithmetic on.
  return `${size.toFixed(size % 1 === 0 ? 0 : 1)} ${UNITS[unit]}`;
}
