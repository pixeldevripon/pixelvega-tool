import { ApiProperty } from '@nestjs/swagger';

/**
 * The closed set of tones a client may be asked to render.
 *
 * Fixed deliberately, and fixed at exactly what `components/ui/badge.tsx`
 * already implements, so that the client's only job is mapping a tone name onto
 * a class. Adding a sixth tone is a change to both repositories, which is the
 * point: a server that can invent tones has handed the client a rendering
 * problem it cannot solve.
 */
export const DISPLAY_TONES = [
  'default',
  'primary',
  'success',
  'warning',
  'danger',
] as const;

export type DisplayTone = (typeof DISPLAY_TONES)[number];

/**
 * How every enum reaches a client (ADR 0001).
 *
 * The three fields are not equal in status, and the difference is the whole
 * decision:
 *
 * - `value` is canonical. Machine readable, stable, and the ONLY field a client
 *   may branch on. Anything keying off `label` is a bug.
 * - `tone` is domain knowledge. Deciding that waiting on a client is a warning
 *   while being on hold is equally bad is a judgment about the business, not a
 *   styling choice, and two clients must not be free to disagree about it.
 * - `label` is an advisory default, supplied so every client gets correct
 *   wording for free. A localized client may ignore it and translate `value`.
 */
export class EnumDisplayDto {
  @ApiProperty({
    example: 'IN_PROGRESS',
    description:
      'The canonical enum member. The only field a client may branch on.',
  })
  value!: string;

  @ApiProperty({
    example: 'In progress',
    description:
      'Advisory display text. Correct English for this value; not a contract.',
  })
  label!: string;

  @ApiProperty({
    enum: DISPLAY_TONES,
    example: 'primary',
    description:
      'Severity, decided by the server. Map it onto a class and nothing else.',
  })
  tone!: DisplayTone;
}

/**
 * A choice in a select, where there is nothing to be severe about.
 *
 * Deliberately NOT an `EnumDisplayDto` with `tone: 'default'`. A country is not
 * an enum: the list comes from a standard rather than from the schema, it has no
 * business meaning to grade, and a tone field on 249 rows would be 249 lies
 * about a judgment nobody made. Reach for this whenever the answer to "how
 * severely does this read" is "it does not".
 */
export class OptionDto {
  @ApiProperty({
    example: 'BD',
    description: 'The stored value. The only field a client may branch on.',
  })
  value!: string;

  @ApiProperty({ example: 'Bangladesh', description: 'Advisory display text.' })
  label!: string;
}
