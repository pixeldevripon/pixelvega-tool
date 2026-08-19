import { Transform, TransformFnParams } from 'class-transformer';

/**
 * Trim surrounding whitespace off a string before it is validated.
 *
 * Applied to the fields where emptiness carries meaning: a `reason` of `"   "`
 * satisfies `@IsNotEmpty()` on its own, reaches the database, and shows a
 * reader a blank where a justification should be. Trimming first makes
 * `@IsNotEmpty()` answer the question people think it is answering.
 *
 * Order matters: this must sit above the validators, because
 * `class-transformer` runs before `class-validator`.
 */
export function Trim() {
  return Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim() : value,
  );
}
