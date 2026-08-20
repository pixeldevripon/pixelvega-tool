import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SEARCH_DEBOUNCE_MS,
  useTableState,
  type TableStateConfig,
} from "@/components/data-table/use-table-state";

/**
 * The hook talks to the router, so the router is the thing to assert against:
 * every test below checks the query string it WROTE, not internal state. That
 * is what a user experiences, and it is what TanStack Query keys off.
 */
const replace = vi.fn();
let currentSearch = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/dashboard/projects",
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

/** The query string of the last `router.replace`, as params. */
function lastWritten() {
  const url = replace.mock.calls.at(-1)?.[0] as string;
  return new URLSearchParams(url.split("?")[1] ?? "");
}

/** Filter keys must be a module constant: see the comment in the hook. */
const FILTER_KEYS = ["status", "priority"] as const;

function Probe({ config }: { config?: TableStateConfig }) {
  const state = useTableState(config);
  return (
    <div>
      <span data-testid="page">{state.page}</span>
      <span data-testid="pageSize">{state.pageSize}</span>
      <span data-testid="search">{state.search}</span>
      <span data-testid="searchInput">{state.searchInput}</span>
      <span data-testid="sortBy">{state.sortBy ?? "none"}</span>
      <span data-testid="sortOrder">{state.sortOrder}</span>
      <span data-testid="status">{state.filters.status ?? "none"}</span>
      <span data-testid="isFiltered">{String(state.isFiltered)}</span>

      <input
        aria-label="search"
        value={state.searchInput}
        onChange={(event) => state.setSearch(event.target.value)}
      />
      <button onClick={() => state.setPage(3)}>page 3</button>
      <button onClick={() => state.setPageSize(50)}>50 per page</button>
      <button onClick={() => state.setSort("deadline")}>sort deadline</button>
      <button onClick={() => state.setSort("name")}>sort name</button>
      <button onClick={() => state.setFilter("status", "ACTIVE")}>filter active</button>
      <button onClick={() => state.setFilter("status", undefined)}>clear status</button>
      <button onClick={() => state.reset()}>reset</button>
    </div>
  );
}

beforeEach(() => {
  replace.mockClear();
  currentSearch = "";
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("reading the URL", () => {
  it("defaults to page 1 and the default page size", () => {
    render(<Probe />);
    expect(screen.getByTestId("page")).toHaveTextContent("1");
    expect(screen.getByTestId("pageSize")).toHaveTextContent("20");
  });

  it("reads page, page size, search and sort from the query string", () => {
    currentSearch = "page=4&pageSize=50&q=atlas&sortBy=deadline&sortOrder=asc";
    render(<Probe />);

    expect(screen.getByTestId("page")).toHaveTextContent("4");
    expect(screen.getByTestId("pageSize")).toHaveTextContent("50");
    expect(screen.getByTestId("search")).toHaveTextContent("atlas");
    expect(screen.getByTestId("sortBy")).toHaveTextContent("deadline");
    expect(screen.getByTestId("sortOrder")).toHaveTextContent("asc");
  });

  it.each(["page=0", "page=-2", "page=abc", "page=1.5"])(
    "falls back to page 1 for a nonsense %s",
    (query) => {
      currentSearch = query;
      render(<Probe />);
      expect(screen.getByTestId("page")).toHaveTextContent("1");
    },
  );

  it("reads only the filter keys it was given", () => {
    currentSearch = "status=ACTIVE&somethingElse=x";
    render(<Probe config={{ filterKeys: FILTER_KEYS }} />);
    expect(screen.getByTestId("status")).toHaveTextContent("ACTIVE");
  });

  it("uses the configured default sort when the URL has none", () => {
    render(<Probe config={{ defaultSortBy: "createdAt", defaultSortOrder: "asc" }} />);
    expect(screen.getByTestId("sortBy")).toHaveTextContent("createdAt");
    expect(screen.getByTestId("sortOrder")).toHaveTextContent("asc");
  });
});

describe("writing the URL", () => {
  it("writes the page and keeps it, since paging IS a page change", async () => {
    currentSearch = "page=2";
    render(<Probe />);

    await userEvent.click(screen.getByText("page 3"));

    expect(lastWritten().get("page")).toBe("3");
  });

  it("does not scroll the viewport, so the toolbar stays under the cursor", async () => {
    render(<Probe />);
    await userEvent.click(screen.getByText("page 3"));
    expect(replace.mock.calls.at(-1)?.[1]).toEqual({ scroll: false });
  });

  it("resets to page 1 when the page size changes", async () => {
    currentSearch = "page=7";
    render(<Probe />);

    await userEvent.click(screen.getByText("50 per page"));

    const written = lastWritten();
    expect(written.get("pageSize")).toBe("50");
    expect(written.has("page")).toBe(false);
  });

  it("resets to page 1 when a filter changes, or the list looks empty", async () => {
    // The commonest list bug: filter to one result while on page 7 and the
    // table is blank, with nothing on screen explaining why.
    currentSearch = "page=7";
    render(<Probe config={{ filterKeys: FILTER_KEYS }} />);

    await userEvent.click(screen.getByText("filter active"));

    const written = lastWritten();
    expect(written.get("status")).toBe("ACTIVE");
    expect(written.has("page")).toBe(false);
  });

  it("removes a filter rather than writing an empty value", async () => {
    currentSearch = "status=ACTIVE";
    render(<Probe config={{ filterKeys: FILTER_KEYS }} />);

    await userEvent.click(screen.getByText("clear status"));

    expect(lastWritten().has("status")).toBe(false);
  });

  it("keeps params it does not own", async () => {
    currentSearch = "tab=members&status=ACTIVE";
    render(<Probe config={{ filterKeys: FILTER_KEYS }} />);

    await userEvent.click(screen.getByText("page 3"));

    expect(lastWritten().get("tab")).toBe("members");
  });
});

describe("sorting", () => {
  it("starts a new column descending, because the interesting end is the top", async () => {
    render(<Probe />);

    await userEvent.click(screen.getByText("sort deadline"));

    const written = lastWritten();
    expect(written.get("sortBy")).toBe("deadline");
    expect(written.get("sortOrder")).toBe("desc");
  });

  it("flips to ascending on a second click of the same column", async () => {
    currentSearch = "sortBy=deadline&sortOrder=desc";
    render(<Probe />);

    await userEvent.click(screen.getByText("sort deadline"));

    expect(lastWritten().get("sortOrder")).toBe("asc");
  });

  it("goes back to descending when a different column is clicked", async () => {
    currentSearch = "sortBy=deadline&sortOrder=asc";
    render(<Probe />);

    await userEvent.click(screen.getByText("sort name"));

    const written = lastWritten();
    expect(written.get("sortBy")).toBe("name");
    expect(written.get("sortOrder")).toBe("desc");
  });

  it("resets to page 1, since row 140 of one order is not row 140 of the other", async () => {
    currentSearch = "page=7&sortBy=name&sortOrder=asc";
    render(<Probe />);

    await userEvent.click(screen.getByText("sort deadline"));

    expect(lastWritten().has("page")).toBe(false);
  });
});

describe("search", () => {
  /**
   * `fireEvent.change` rather than `userEvent.type` in this block.
   * `userEvent` schedules its own timers between keystrokes, and under
   * `vi.useFakeTimers()` those never fire, so the interaction never completes.
   * One change event per "typed" value is enough here: what is under test is
   * the debounce, not the browser's key handling.
   */
  function type(value: string) {
    act(() => {
      fireEvent.change(screen.getByLabelText("search"), { target: { value } });
    });
  }

  it("updates the input on every keystroke without writing the URL", () => {
    vi.useFakeTimers();
    render(<Probe />);

    type("a");
    type("at");
    type("atl");

    expect(screen.getByTestId("searchInput")).toHaveTextContent("atl");
    expect(replace).not.toHaveBeenCalled();
  });

  it("writes the URL once, after the debounce", () => {
    vi.useFakeTimers();
    render(<Probe />);

    type("a");
    type("atl");
    type("atlas");
    expect(replace).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });

    expect(replace).toHaveBeenCalledTimes(1);
    expect(lastWritten().get("q")).toBe("atlas");
  });

  it("resets to page 1 when the term is committed", () => {
    vi.useFakeTimers();
    currentSearch = "page=5";
    render(<Probe />);

    type("a");
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });

    expect(lastWritten().has("page")).toBe(false);
  });

  it("takes the term from the URL, so a shared link arrives pre-filled", () => {
    currentSearch = "q=atlas";
    render(<Probe />);
    expect(screen.getByTestId("searchInput")).toHaveTextContent("atlas");
  });
});

describe("isFiltered and reset", () => {
  it("is false with nothing narrowing the list", () => {
    currentSearch = "page=3&sortBy=name";
    render(<Probe config={{ filterKeys: FILTER_KEYS }} />);
    // A page and a sort order are not filters: they do not hide rows.
    expect(screen.getByTestId("isFiltered")).toHaveTextContent("false");
  });

  it.each(["q=atlas", "status=ACTIVE", "priority=HIGH"])(
    "is true with %s",
    (query) => {
      currentSearch = query;
      render(<Probe config={{ filterKeys: FILTER_KEYS }} />);
      expect(screen.getByTestId("isFiltered")).toHaveTextContent("true");
    },
  );

  it("clears the search, every filter and the page, but not the sort", async () => {
    currentSearch = "q=atlas&status=ACTIVE&priority=HIGH&page=4&sortBy=name&sortOrder=asc";
    render(<Probe config={{ filterKeys: FILTER_KEYS }} />);

    await userEvent.click(screen.getByText("reset"));

    const written = lastWritten();
    expect(written.has("q")).toBe(false);
    expect(written.has("status")).toBe(false);
    expect(written.has("priority")).toBe(false);
    expect(written.has("page")).toBe(false);
    // The sort survives: it is how the user chose to read the list, not a
    // filter, and clearing it would silently reorder what they are looking at.
    expect(written.get("sortBy")).toBe("name");
  });
});

describe("prefix", () => {
  it("namespaces every param, so two lists on one screen page independently", async () => {
    currentSearch = "blockers_page=2&page=9";
    render(<Probe config={{ prefix: "blockers", filterKeys: FILTER_KEYS }} />);

    expect(screen.getByTestId("page")).toHaveTextContent("2");

    await userEvent.click(screen.getByText("page 3"));

    const written = lastWritten();
    expect(written.get("blockers_page")).toBe("3");
    // The other list's page is untouched.
    expect(written.get("page")).toBe("9");
  });

  it("reads prefixed filters", () => {
    currentSearch = "blockers_status=OPEN&status=ACTIVE";
    render(<Probe config={{ prefix: "blockers", filterKeys: FILTER_KEYS }} />);
    expect(screen.getByTestId("status")).toHaveTextContent("OPEN");
  });
});
