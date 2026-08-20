import { applyDecorators } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

import * as FieldLength from '@/common/constants/field-lengths';

/**
 * A free text search filter on a list endpoint.
 *
 * The same four validators were written out at every search box: optional, a
 * string, not blank, and bounded. Four copies before this existed, and the two
 * that matter are the last two. `@IsNotEmpty()` is what stops `?search=`
 * reaching the database as an empty `contains`, which matches every row and
 * looks like a broken filter. `@MaxLength` is what stops an unbounded string
 * becoming an unbounded `LIKE` (D5: a length bound on every free text field,
 * from `field-lengths.ts`, never an inline number).
 *
 * The `@ApiPropertyOptional` stays at the call site: the description genuinely
 * differs per field, because what a search matches is the useful thing to say.
 */
export function IsSearchTerm() {
  return applyDecorators(
    IsOptional(),
    IsString(),
    IsNotEmpty(),
    MaxLength(FieldLength.SHORT_TEXT),
  );
}
