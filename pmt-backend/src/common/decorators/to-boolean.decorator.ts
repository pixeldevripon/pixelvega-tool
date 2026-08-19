import { Transform, TransformFnParams } from 'class-transformer';

/**
 * Parse a boolean out of a query string.
 *
 * **Do not use `@Type(() => Boolean)` for this.** It calls `Boolean(value)`, and
 * `Boolean('false')` is `true`, so `?archived=false` asked for non archived
 * projects and got archived ones. Every boolean query param in this API had
 * that bug.
 *
 * Accepts the spellings a client actually sends: `true`/`false`, `1`/`0`, and a
 * bare flag (`?archived`, which arrives as an empty string) meaning true.
 * Anything else is left untouched so `@IsBoolean()` rejects it with a 400,
 * rather than being silently coerced to a value nobody asked for.
 */
export function ToBoolean() {
  return Transform(({ value }: TransformFnParams): unknown => {
    if (typeof value === 'boolean') return value;
    if (value === undefined || value === null) return value;
    if (typeof value !== 'string') return value;

    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === '') {
      return true;
    }
    if (normalized === 'false' || normalized === '0') return false;
    // Deliberately not coerced. Let @IsBoolean() answer with a 400 naming the
    // field, which is more use than silently guessing.
    return value;
  });
}
