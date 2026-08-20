import { Transform, TransformFnParams } from 'class-transformer';

/**
 * Accept a multi-value query param in either spelling clients actually send.
 *
 * `?role=DEVELOPER,DESIGNER` (comma separated) and
 * `?role=DEVELOPER&role=DESIGNER` (repeated) both arrive here, and the second
 * form arrives as an array only when there is more than one value: a single
 * `?role=DEVELOPER` is a bare string. Every caller of this needs all three cases
 * handled, and the transform body was byte identical in two DTOs before this
 * existed.
 *
 * It normalises the SHAPE and nothing else. Anything that is not a string or an
 * array is passed through untouched so the element validator (`@IsEnum(X, { each
 * })` or `@IsIn(SUBSET, { each })`) rejects it with a 400, rather than being
 * silently coerced into a value nobody asked for. The element validator differs
 * per field, which is why it stays at the call site.
 *
 * Pair it with `@IsArray()`, as `@ToBoolean()` pairs with `@IsBoolean()`.
 */
export function ToArray() {
  return Transform(({ value }: TransformFnParams): unknown => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    }
    return value;
  });
}
