import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

/**
 * The two directions, as a closed set.
 *
 * A string union would let `?sortOrder=ASC` through and then order by nothing,
 * silently. `@IsIn` makes it a 400 instead.
 */
export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

/**
 * Sorting is a query parameter, never a client side `.sort()` (D4).
 *
 * The reason is correctness before it is tidiness: a client sorting the page it
 * was given reorders twenty rows out of two hundred and presents the result as
 * "sorted by name", which it is not. The server sorts before it paginates, so
 * page one really does hold the first twenty.
 *
 * Each module extends this with its own `sortBy`, because the sortable columns
 * are per resource and a shared string field would accept a column that does
 * not exist on the model being queried.
 */
export class SortQueryDto {
  @ApiPropertyOptional({
    enum: SORT_ORDERS,
    default: 'asc',
    description: 'Direction. Applies to whichever sortBy is in force.',
  })
  @IsOptional()
  @IsIn(SORT_ORDERS)
  sortOrder?: SortOrder = 'asc';
}
