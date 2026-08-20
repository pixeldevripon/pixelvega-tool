/**
 * Shapes every module's API client shares.
 *
 * `Paginated` lived in `types/projects.ts` and was imported from there by
 * blockers, users, leave, audit logs and notifications. Nothing about it is a
 * project, and a module reaching into another module's type file to borrow one
 * is the first step towards reaching in for a real one.
 */

/**
 * A page of results.
 *
 * `total` is the count BEFORE paging, which is the only number a pager can work
 * from. The API filters and sorts before it pages, so page one really does hold
 * the first rows and this client never re-sorts what it was handed (D4).
 *
 * Some endpoints add their own fields alongside these four (`/projects/mine`
 * carries an `overloaded` hint). Those belong on the module's own response type,
 * not here.
 */
export type Paginated<T> = {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
};
