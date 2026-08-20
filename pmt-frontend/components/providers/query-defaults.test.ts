import { describe, expect, it } from "vitest";
import {
  DEFAULT_STALE_TIME_MS,
  MAX_QUERY_RETRIES,
  queryDefaults,
  queryRetryDelay,
  shouldRetryQuery,
} from "@/components/providers/query-defaults";
import { ApiError } from "@/lib/api/fetch";

describe("queryDefaults", () => {
  it("holds a value for thirty seconds", () => {
    expect(queryDefaults.queries?.staleTime).toBe(30_000);
    expect(DEFAULT_STALE_TIME_MS).toBe(30_000);
  });

  it("refetches when the tab regains focus", () => {
    expect(queryDefaults.queries?.refetchOnWindowFocus).toBe(true);
  });

  it("never retries a mutation", () => {
    expect(queryDefaults.mutations?.retry).toBe(false);
  });
});

describe("shouldRetryQuery", () => {
  it("retries a dropped connection", () => {
    expect(shouldRetryQuery(0, new ApiError("offline", 0))).toBe(true);
  });

  it.each([500, 502, 504])("retries %i", (status) => {
    expect(shouldRetryQuery(0, new ApiError("boom", status))).toBe(true);
  });

  it("stops after two attempts", () => {
    const error = new ApiError("boom", 500);
    expect(shouldRetryQuery(MAX_QUERY_RETRIES - 1, error)).toBe(true);
    expect(shouldRetryQuery(MAX_QUERY_RETRIES, error)).toBe(false);
  });

  it.each([400, 401, 403, 404, 409, 422])(
    "does not retry %i, which is a settled answer",
    (status) => {
      expect(shouldRetryQuery(0, new ApiError("no", status))).toBe(false);
    },
  );

  it.each([429, 503])(
    "does not retry %i, because apiFetch already did and retrying would multiply",
    (status) => {
      expect(shouldRetryQuery(0, new ApiError("slow down", status))).toBe(false);
    },
  );

  it("does not retry an error that did not come from the API layer", () => {
    // A TypeError here means a bug in a queryFn, not a network problem.
    expect(shouldRetryQuery(0, new TypeError("x is not a function"))).toBe(false);
  });
});

describe("queryRetryDelay", () => {
  it("backs off exponentially", () => {
    expect(queryRetryDelay(0)).toBe(1_000);
    expect(queryRetryDelay(1)).toBe(2_000);
    expect(queryRetryDelay(2)).toBe(4_000);
  });

  it("caps, so a late attempt is not a minute away", () => {
    expect(queryRetryDelay(20)).toBe(10_000);
  });
});
