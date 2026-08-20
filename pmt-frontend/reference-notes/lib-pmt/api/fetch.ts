/**
 * The one way this app talks to the API.
 *
 * Everything under `lib/api/` goes through `apiFetch`. Nothing else calls
 * `fetch` directly, because four things have to be true on every request and
 * getting three of them right is the same as getting none:
 *
 * 1. `credentials: 'include'`. The session is an httpOnly cookie on the API's
 *    origin, so a request without this is anonymous and 401s.
 * 2. Every failure arrives as an `ApiError` whose `message` is safe to toast
 *    verbatim. Raw technical text never reaches a user (`humane-error.ts`).
 * 3. A request that hangs is abandoned rather than leaving a spinner forever.
 * 4. A 429 or a 503 is retried, and ONLY for a GET. See `isRetryable`.
 *
 * It calls bare `setTimeout`, not `window.setTimeout`, so it also runs in a
 * server component. The previous client called the window form, which meant any
 * attempt to fetch during a server render threw `window is not defined` before
 * it reached the network.
 */

import { humaneError } from "@/lib/api/humane-error";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";

/** How long one attempt may take before it is abandoned. */
const DEFAULT_TIMEOUT_MS = 15_000;

/** A download is a file rather than a page of JSON, so it gets longer. */
const DOWNLOAD_TIMEOUT_MS = 30_000;

/** Attempts after the first. Three total, which is where a transient blip stops looking transient. */
const MAX_RETRIES = 2;

/** First backoff step. Doubles per attempt, then has full jitter applied. */
const RETRY_BASE_MS = 300;

/** Backoff ceiling. Past this a user would rather see the error than keep waiting. */
const RETRY_CAP_MS = 4_000;

/**
 * The two statuses worth retrying.
 *
 * 429 because the API's throttler is sized for a dashboard page load and a
 * burst of parallel queries can legitimately clip it. 503 because it is what a
 * restarting or draining instance returns.
 *
 * Not 500: it means a bug, and repeating the request repeats the bug. Not 502
 * or 504 either, for a subtler reason: the request may well have been processed
 * upstream, so a retry is not safe even though it looks like one.
 */
const RETRYABLE_STATUSES = new Set([429, 503]);

/** Cap on a server-supplied `Retry-After`. A wrong or hostile header must not hang the UI. */
const MAX_RETRY_AFTER_MS = 10_000;

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  timeoutMs?: number;
};

/**
 * Every failure this module throws.
 *
 * The shape is unchanged from the client it replaces (`message` plus `status`),
 * because roughly a hundred call sites branch on `error.status === 404` or
 * `=== 401`. `status` is 0 when the request never got a response at all, which
 * is how a caller tells "the server said no" from "there was no server".
 */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

/**
 * Parse a body without letting a non-JSON response throw.
 *
 * A 502 from a proxy is an HTML page, and `JSON.parse` on it throws a
 * `SyntaxError` that used to escape this module and reach a user as
 * "Unexpected token '<'". Returning the raw text instead lets `humaneError`
 * recognise it as not-prose and substitute the status sentence.
 */
function parseBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/**
 * Full jitter exponential backoff.
 *
 * Jittered rather than fixed because every screen fires several queries at
 * once: without jitter a 429 makes all of them wait the same interval and
 * retry in the same instant, which is the burst that caused the 429.
 */
function backoffMs(attempt: number, random: () => number = Math.random) {
  return Math.round(random() * Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_CAP_MS));
}

/** `Retry-After` is either a count of seconds or an HTTP date. Both are legal, so read both. */
function retryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) {
    return seconds <= 0 ? 0 : Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  }
  const date = Date.parse(header);
  if (Number.isNaN(date)) return null;
  return Math.min(Math.max(0, date - Date.now()), MAX_RETRY_AFTER_MS);
}

/**
 * Is retrying this safe AND likely to help?
 *
 * Both halves matter, and the method is the safety half. A retried GET is free;
 * a retried POST can create a second record, because a 503 does not tell us
 * whether the write landed before the instance went away. Until the API offers
 * an idempotency key there is nothing to make a mutation retry safe, so the
 * answer for anything other than GET is no.
 */
function isRetryable(method: string, status: number) {
  return method === "GET" && RETRYABLE_STATUSES.has(status);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * One signal from the caller's and our timeout's.
 *
 * `AbortSignal.any` is the right tool and is present everywhere this runs, but
 * the fallback matters more than it looks: the client this replaces wrote
 * `signal: options.signal ?? controller.signal`, so passing a signal silently
 * turned the timeout OFF. A request from a component that supplied its own
 * abort signal could hang forever.
 */
function combineSignals(signals: AbortSignal[]): AbortSignal {
  if (signals.length === 1) return signals[0];
  if (typeof AbortSignal.any === "function") return AbortSignal.any(signals);

  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), {
      once: true,
    });
  }
  return controller.signal;
}

interface Attempt {
  response: Response;
  text: string;
}

/**
 * One attempt, with its own timeout.
 *
 * The timeout is per attempt rather than for the whole call, which is the
 * behaviour a user expects: a retried request gets a fair chance rather than
 * inheriting whatever is left of a shared budget.
 */
async function attemptFetch(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  callerSignal: AbortSignal | null | undefined,
): Promise<Attempt> {
  const timeoutController = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    timeoutController.abort();
  }, timeoutMs);

  const signals = callerSignal
    ? [callerSignal, timeoutController.signal]
    : [timeoutController.signal];

  try {
    const response = await fetch(url, {
      ...init,
      signal: combineSignals(signals),
    });
    return { response, text: await response.text() };
  } catch (error) {
    // Our timeout fired: report it as a status so callers can treat it like any
    // other failure. A caller-initiated abort is rethrown untouched, because
    // TanStack Query reads it as a cancellation rather than an error, and
    // dressing it up as a 408 would surface a toast for a navigation.
    if (timedOut) {
      throw new ApiError(humaneError(408), 408);
    }
    if (callerSignal?.aborted) throw error;

    // No response at all: DNS, a refused connection, CORS, or offline. `fetch`
    // rejects with a bare TypeError here, whose message names none of those.
    throw new ApiError(humaneError(0), 0);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Call the API and return the parsed body.
 *
 * @throws ApiError on any non-2xx response, on a timeout, and on a transport
 * failure. Never anything else, so a call site only has to know one type.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { body, timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...rest } = options;
  const headers = new Headers(rest.headers);
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const method = (rest.method ?? "GET").toUpperCase();

  // FormData sets its own Content-Type, including the multipart boundary.
  // Setting one by hand produces a boundary-less header the server cannot parse.
  if (body !== undefined && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const init: RequestInit = {
    ...rest,
    method,
    headers,
    credentials: "include",
    body:
      body === undefined
        ? undefined
        : isFormData
          ? (body as FormData)
          : JSON.stringify(body),
  };

  const url = `${API_URL}${normalizePath(path)}`;

  for (let attempt = 0; ; attempt += 1) {
    const { response, text } = await attemptFetch(url, init, timeoutMs, signal);

    if (response.ok) {
      // 204 and an empty 200 are both legitimate: a delete returns no body.
      return (text ? parseBody(text) : undefined) as T;
    }

    if (attempt < MAX_RETRIES && isRetryable(method, response.status)) {
      const after = retryAfterMs(response.headers.get("Retry-After"));
      await sleep(after ?? backoffMs(attempt));
      continue;
    }

    throw new ApiError(humaneError(response.status, parseBody(text)), response.status);
  }
}

export interface DownloadResult {
  blob: Blob;
  filename?: string;
}

/**
 * Fetch a file rather than JSON.
 *
 * Separate from `apiFetch` rather than a flag on it, because the two differ in
 * their return type, their timeout, and how they read a failure: an export
 * endpoint answers a problem with JSON even though success is a CSV, so the
 * error path has to parse a body that the success path never touches.
 */
export async function apiDownload(
  path: string,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<DownloadResult> {
  const timeoutController = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    timeoutController.abort();
  }, options.timeoutMs ?? DOWNLOAD_TIMEOUT_MS);

  const signals = options.signal
    ? [options.signal, timeoutController.signal]
    : [timeoutController.signal];

  try {
    const response = await fetch(`${API_URL}${normalizePath(path)}`, {
      credentials: "include",
      signal: combineSignals(signals),
    });

    if (!response.ok) {
      throw new ApiError(
        humaneError(response.status, parseBody(await response.text())),
        response.status,
      );
    }

    const disposition = response.headers.get("Content-Disposition") ?? "";
    const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
    return { blob: await response.blob(), filename: filenameMatch?.[1] };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (timedOut) throw new ApiError(humaneError(408), 408);
    if (options.signal?.aborted) throw error;
    throw new ApiError(humaneError(0), 0);
  } finally {
    clearTimeout(timer);
  }
}
