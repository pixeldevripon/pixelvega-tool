"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * List state, in the URL.
 *
 * Page, page size, search term, sort and filters all live in the query string
 * rather than in component state, and that is not a preference:
 *
 * - A filtered list becomes a link. "The three overdue projects" is something
 *   you can paste into Slack, and the person who opens it sees the same three.
 * - Back and forward work. Opening a project and returning does not silently
 *   drop you on page 1 of an unfiltered list.
 * - A reload keeps your place, which matters most on the screens where losing
 *   it costs the most work.
 *
 * It also removes a whole class of bug. Each list screen previously kept page,
 * search, a debounce timer and a `latestRequestRef` in its own `useState`, and
 * every copy raced slightly differently. Here the URL is the single source of
 * truth and TanStack Query keys off it, so a stale response for a filter the
 * user has already changed cannot be rendered: it belongs to a different key.
 *
 * **This hook derives nothing.** It reads and writes query params. The server
 * sorts, filters and paginates; the values here are sent to it, never applied
 * to a page of rows that has already arrived (D4).
 */

/** How long to wait after the last keystroke before the search reaches the URL. */
export const SEARCH_DEBOUNCE_MS = 300;

export const DEFAULT_PAGE_SIZE = 20;

export type SortOrder = "asc" | "desc";

export interface TableStateConfig {
  /**
   * Prefix for every param this instance owns.
   *
   * Needed because a detail screen can show two independent lists (a project's
   * blockers and its work reports), and without a prefix they would share
   * `page` and paginate together.
   */
  prefix?: string;
  defaultPageSize?: number;
  defaultSortBy?: string;
  defaultSortOrder?: SortOrder;
  /**
   * Filter params this instance owns, so `reset` knows what to clear and
   * `filters` knows what to read. Naming them is what keeps the hook from
   * clearing a param belonging to something else on the same page.
   */
  filterKeys?: readonly string[];
}

export interface TableState {
  page: number;
  pageSize: number;
  /** The committed term: debounced, in the URL, safe to put in a query key. */
  search: string;
  /** What the input shows: updates on every keystroke. Never send this to the API. */
  searchInput: string;
  sortBy?: string;
  sortOrder: SortOrder;
  filters: Record<string, string | undefined>;

  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSearch: (value: string) => void;
  setSort: (column: string) => void;
  setFilter: (key: string, value: string | undefined) => void;
  reset: () => void;

  /** True when anything is narrowing the list. Drives the "clear filters" affordance. */
  isFiltered: boolean;
}

function readNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function useTableState(config: TableStateConfig = {}): TableState {
  const {
    prefix = "",
    defaultPageSize = DEFAULT_PAGE_SIZE,
    defaultSortBy,
    defaultSortOrder = "desc",
    filterKeys = [],
  } = config;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const key = useCallback((name: string) => (prefix ? `${prefix}_${name}` : name), [prefix]);

  const page = readNumber(searchParams.get(key("page")), 1);
  const pageSize = readNumber(searchParams.get(key("pageSize")), defaultPageSize);
  const search = searchParams.get(key("q")) ?? "";
  const sortBy = searchParams.get(key("sortBy")) ?? defaultSortBy;
  const sortOrder = (searchParams.get(key("sortOrder")) as SortOrder | null) ?? defaultSortOrder;

  /**
   * Writes go through one function so that the page reset cannot be forgotten.
   *
   * Resetting to page 1 on any change other than the page itself is the rule
   * that stops the commonest list bug: filter to one result while on page 3 and
   * the list is empty, with no indication that a page you cannot see is the
   * reason.
   */
  const commit = useCallback(
    (updates: Record<string, string | undefined>, options: { keepPage?: boolean } = {}) => {
      const next = new URLSearchParams(searchParams.toString());

      for (const [name, value] of Object.entries(updates)) {
        if (value === undefined || value === "") next.delete(key(name));
        else next.set(key(name), value);
      }

      if (!options.keepPage) next.delete(key("page"));

      // `scroll: false` because a filter change should leave the viewport
      // alone: the toolbar the user just used is at the top of the list, and
      // jumping to the top of the document moves it out from under them.
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [key, pathname, router, searchParams],
  );

  /**
   * The search box is the one control that cannot write straight to the URL:
   * a keystroke per request would fire ten requests for a five letter word.
   * So the input is local state and the URL is written on a trailing edge.
   */
  const [searchInput, setSearchInput] = useState(search);

  /**
   * Keep the box in step when the URL changes from elsewhere: a back
   * navigation, a "clear filters" click, or a link into a pre-filtered list.
   *
   * Guarded by the ref so this does not fight the debounce. Without it, the
   * effect runs on the commit the debounce just made and can overwrite what
   * has been typed since.
   */
  const lastCommitted = useRef(search);
  useEffect(() => {
    if (search !== lastCommitted.current) {
      lastCommitted.current = search;
      setSearchInput(search);
    }
  }, [search]);

  useEffect(() => {
    if (searchInput === search) return;

    const timer = setTimeout(() => {
      lastCommitted.current = searchInput;
      commit({ q: searchInput });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [commit, search, searchInput]);

  const filters = useMemo(() => {
    const result: Record<string, string | undefined> = {};
    for (const name of filterKeys) {
      result[name] = searchParams.get(key(name)) ?? undefined;
    }
    return result;
    // `filterKeys` must be a module-level constant at the call site, not an
    // inline array literal: a fresh identity every render would re-run this on
    // every render, and `reset` would change identity with it.
  }, [filterKeys, key, searchParams]);

  const setPage = useCallback(
    (value: number) => commit({ page: String(value) }, { keepPage: true }),
    [commit],
  );

  const setPageSize = useCallback(
    (value: number) => commit({ pageSize: String(value) }),
    [commit],
  );

  const setFilter = useCallback(
    (name: string, value: string | undefined) => commit({ [name]: value }),
    [commit],
  );

  /**
   * Clicking a column header cycles the sort on it.
   *
   * A new column starts descending, because on every sortable column in this
   * app (a date, an hour count, a priority) the interesting end is the top.
   * Clicking the current column flips it. There is deliberately no third
   * "unsorted" state: a list has to come back in some order, and an implicit
   * one is worse than a visible one.
   */
  const setSort = useCallback(
    (column: string) => {
      const nextOrder: SortOrder =
        sortBy === column && sortOrder === "desc" ? "asc" : "desc";
      commit({ sortBy: column, sortOrder: nextOrder });
    },
    [commit, sortBy, sortOrder],
  );

  const reset = useCallback(() => {
    const cleared: Record<string, undefined> = { q: undefined, page: undefined };
    for (const name of filterKeys) cleared[name] = undefined;
    setSearchInput("");
    lastCommitted.current = "";
    commit(cleared);
  }, [commit, filterKeys]);

  const isFiltered =
    search !== "" || filterKeys.some((name) => filters[name] !== undefined);

  return {
    page,
    pageSize,
    search,
    searchInput,
    sortBy,
    sortOrder,
    filters,
    setPage,
    setPageSize,
    setSearch: setSearchInput,
    setSort,
    setFilter,
    reset,
    isFiltered,
  };
}
