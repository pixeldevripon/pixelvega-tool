import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiDownload, apiFetch } from "@/lib/api/fetch";

const API_URL = "http://localhost:5050";

/** Build a Response without hand-writing the same five options every time. */
function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Response(body === undefined ? "" : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/**
 * Queue one response per call, so a test asserting a retry can prove the SECOND
 * attempt is the one that succeeded rather than only that the promise resolved.
 */
function mockFetchSequence(...responses: Array<Response | Error>) {
  const fetchMock = vi.fn();
  for (const response of responses) {
    if (response instanceof Error) fetchMock.mockRejectedValueOnce(response);
    else fetchMock.mockResolvedValueOnce(response);
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function lastInit(fetchMock: ReturnType<typeof vi.fn>): RequestInit {
  return fetchMock.mock.calls.at(-1)?.[1] as RequestInit;
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("apiFetch: the request it builds", () => {
  it("prefixes the API base URL and normalises a path without a leading slash", async () => {
    const fetchMock = mockFetchSequence(jsonResponse(200, { ok: true }));
    await apiFetch("projects");
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/projects`);
  });

  it("sends the session cookie, or every request is anonymous", async () => {
    const fetchMock = mockFetchSequence(jsonResponse(200, {}));
    await apiFetch("/users/me");
    expect(lastInit(fetchMock).credentials).toBe("include");
  });

  it("serialises a JSON body and sets the content type", async () => {
    const fetchMock = mockFetchSequence(jsonResponse(201, { id: "p1" }));
    await apiFetch("/projects", { method: "POST", body: { name: "Atlas" } });

    const init = lastInit(fetchMock);
    expect(init.body).toBe('{"name":"Atlas"}');
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
  });

  it("leaves FormData alone, so the multipart boundary survives", async () => {
    const fetchMock = mockFetchSequence(jsonResponse(201, {}));
    const form = new FormData();
    form.append("file", new Blob(["x"]), "a.txt");

    await apiFetch("/projects/p1/documents", { method: "POST", body: form });

    const init = lastInit(fetchMock);
    expect(init.body).toBe(form);
    expect(new Headers(init.headers).has("Content-Type")).toBe(false);
  });

  it("defaults to GET, and uppercases a lowercase method", async () => {
    const fetchMock = mockFetchSequence(jsonResponse(200, {}), jsonResponse(200, {}));
    await apiFetch("/a");
    expect(lastInit(fetchMock).method).toBe("GET");

    await apiFetch("/a", { method: "patch" });
    expect(lastInit(fetchMock).method).toBe("PATCH");
  });
});

describe("apiFetch: the value it returns", () => {
  it("returns the parsed body", async () => {
    mockFetchSequence(jsonResponse(200, { items: [1, 2], total: 2 }));
    await expect(apiFetch("/projects")).resolves.toEqual({ items: [1, 2], total: 2 });
  });

  it("returns undefined for an empty 204, which is what a delete answers", async () => {
    mockFetchSequence(new Response(null, { status: 204 }));
    await expect(apiFetch("/projects/p1")).resolves.toBeUndefined();
  });
});

describe("apiFetch: how it fails", () => {
  it("throws an ApiError carrying the status the call sites branch on", async () => {
    mockFetchSequence(jsonResponse(404, { message: "Project not found" }));

    const error = await apiFetch("/projects/nope").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
    expect((error as ApiError).message).toBe("Project not found");
  });

  it("replaces an HTML error page with a sentence, never showing the markup", async () => {
    mockFetchSequence(
      new Response("<html><body>502 Bad Gateway</body></html>", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      }),
    );

    const error = (await apiFetch("/projects").catch((e: unknown) => e)) as ApiError;
    expect(error.message).toBe("The server is unreachable. Try again in a moment.");
    expect(error.status).toBe(502);
  });

  it("reports a transport failure as status 0, not as a server error", async () => {
    mockFetchSequence(new TypeError("Failed to fetch"));

    const error = (await apiFetch("/projects").catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.message).toBe(
      "Cannot reach the server. Check your connection and try again.",
    );
  });

  it("abandons a hanging request as a 408 using a bare setTimeout", async () => {
    // Never resolves until aborted: exactly the case the timeout exists for.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      ),
    );

    const error = (await apiFetch("/projects", { timeoutMs: 5 }).catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(error.status).toBe(408);
  });

  it("rethrows a caller's abort untouched, so a cancelled query is not a toast", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      ),
    );

    const pending = apiFetch("/projects", { signal: controller.signal });
    controller.abort();

    const error = await pending.catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(ApiError);
    expect((error as DOMException).name).toBe("AbortError");
  });

  it("honours the caller's signal AND the timeout, rather than dropping one", async () => {
    // The client this replaced wrote `signal ?? controller.signal`, so a caller
    // supplying a signal turned the timeout off and the request hung forever.
    const controller = new AbortController();
    const seen: Array<AbortSignal | null | undefined> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        seen.push(init.signal);
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        });
      }),
    );

    const error = (await apiFetch("/projects", {
      signal: controller.signal,
      timeoutMs: 5,
    }).catch((e: unknown) => e)) as ApiError;

    expect(error.status).toBe(408);
    expect(seen[0]).not.toBe(controller.signal);
  });
});

describe("apiFetch: retry", () => {
  it("retries a GET on 429 and returns the successful attempt's body", async () => {
    const fetchMock = mockFetchSequence(
      jsonResponse(429, { message: "Too many requests" }),
      jsonResponse(200, { items: [] }),
    );

    await expect(apiFetch("/projects")).resolves.toEqual({ items: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a GET on 503", async () => {
    const fetchMock = mockFetchSequence(
      jsonResponse(503, {}),
      jsonResponse(200, { ok: true }),
    );

    await expect(apiFetch("/projects")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after two retries and throws the last status", async () => {
    const fetchMock = mockFetchSequence(
      jsonResponse(503, {}),
      jsonResponse(503, {}),
      jsonResponse(503, {}),
    );

    const error = (await apiFetch("/projects").catch((e: unknown) => e)) as ApiError;
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(error.status).toBe(503);
  });

  it.each(["POST", "PATCH", "PUT", "DELETE"] as const)(
    "never retries a %s, because the write may already have landed",
    async (method) => {
      const fetchMock = mockFetchSequence(jsonResponse(503, {}));

      const error = (await apiFetch("/projects", { method, body: {} }).catch(
        (e: unknown) => e,
      )) as ApiError;

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(error.status).toBe(503);
    },
  );

  it.each([500, 502, 504, 409, 401])(
    "does not retry %i, where a repeat cannot help or is not safe",
    async (status) => {
      const fetchMock = mockFetchSequence(jsonResponse(status, {}));
      await apiFetch("/projects").catch(() => undefined);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("waits for a Retry-After of one second rather than its own shorter backoff", async () => {
    const fetchMock = mockFetchSequence(
      jsonResponse(429, {}, { "Retry-After": "1" }),
      jsonResponse(200, { ok: true }),
    );

    const started = Date.now();
    await expect(apiFetch("/projects")).resolves.toEqual({ ok: true });
    const waited = Date.now() - started;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Jittered backoff maxes out at 300ms on the first attempt, so anything
    // near a second can only have come from the header.
    expect(waited).toBeGreaterThanOrEqual(900);
  });

  it("caps an absurd Retry-After instead of hanging for a day", async () => {
    const fetchMock = mockFetchSequence(
      jsonResponse(503, {}, { "Retry-After": "86400" }),
      jsonResponse(200, { ok: true }),
    );

    const started = Date.now();
    await expect(apiFetch("/projects")).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(Date.now() - started).toBeLessThan(11_000);
  }, 15_000);

  it("ignores an unparseable Retry-After and uses its own backoff", async () => {
    const fetchMock = mockFetchSequence(
      jsonResponse(429, {}, { "Retry-After": "soon" }),
      jsonResponse(200, { ok: true }),
    );

    const started = Date.now();
    await expect(apiFetch("/projects")).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(Date.now() - started).toBeLessThan(500);
  });
});

describe("apiDownload", () => {
  it("returns the blob and the filename from Content-Disposition", async () => {
    mockFetchSequence(
      new Response("a,b\n1,2", {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="report.csv"',
        },
      }),
    );

    const result = await apiDownload("/reports/developers/export");
    expect(result.filename).toBe("report.csv");
    expect(await result.blob.text()).toBe("a,b\n1,2");
  });

  it("has no filename when the header is absent", async () => {
    mockFetchSequence(new Response("x", { status: 200 }));
    await expect(apiDownload("/x")).resolves.toMatchObject({ filename: undefined });
  });

  it("reads a JSON failure even though success would have been a file", async () => {
    mockFetchSequence(jsonResponse(403, { message: "You cannot export this project." }));

    const error = (await apiDownload("/x").catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(403);
    expect(error.message).toBe("You cannot export this project.");
  });

  it("times out as a 408", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      ),
    );

    const error = (await apiDownload("/x", { timeoutMs: 5 }).catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(error.status).toBe(408);
  });
});
