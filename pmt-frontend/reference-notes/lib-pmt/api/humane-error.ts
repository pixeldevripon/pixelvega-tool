/**
 * Turning a failed response into one sentence a person can act on.
 *
 * Pure by design: no `fetch`, no React, no imports from this package. That is
 * what makes it testable without a DOM and reusable from a server component,
 * and it is why the retry and abort logic lives next door in `fetch.ts` rather
 * than here.
 *
 * The contract with the API (`pmt-backend/src/common/dto/error-responses.dto.ts`)
 * is that `message` is written for a human and safe to render verbatim. This
 * module exists for the cases where that promise cannot be kept: a proxy
 * returning HTML, a gateway timing out before Nest is reached, a 500 whose
 * message is a stack frame. In those cases the raw text must never reach a
 * user, so a status-based sentence replaces it.
 */

/** The error envelope `AllExceptionsFilter` produces. Every field optional: a failure may not have come from the API at all. */
export interface ApiErrorPayload {
  statusCode?: number;
  timestamp?: string;
  path?: string;
  message?: string | string[];
}

/**
 * Copy per status, for when the payload carries nothing usable.
 *
 * Second person, active voice, and each one says what to do next rather than
 * only what went wrong. 401 is the exception: the app redirects on it, so its
 * text is a fallback that should rarely be seen.
 */
const STATUS_COPY: Record<number, string> = {
  400: "Some of the details are not valid. Check the highlighted fields and try again.",
  401: "Your session has ended. Sign in again to continue.",
  403: "You do not have permission to do that.",
  404: "That item no longer exists. It may have been deleted or renamed.",
  408: "The request took too long. Check your connection and try again.",
  409: "That conflicts with something already saved. Reload the page to see the current state.",
  413: "That file is too large to upload.",
  422: "Some of the details are not valid. Check the highlighted fields and try again.",
  429: "Too many requests. Wait a moment and try again.",
  500: "Something went wrong on our side. Try again in a moment.",
  502: "The server is unreachable. Try again in a moment.",
  503: "The service is temporarily unavailable. Try again in a moment.",
  504: "The server took too long to respond. Try again in a moment.",
};

/** Used when the status is not one we have copy for, and is not obviously a client mistake. */
const UNKNOWN_FAILURE = "Something went wrong. Try again in a moment.";

/** No status at all: the request never reached a server. */
const OFFLINE = "Cannot reach the server. Check your connection and try again.";

/**
 * The longest raw message worth showing.
 *
 * A validation failure across several fields legitimately runs long once the
 * constraint strings are joined, so this is generous. Past it, the text is
 * almost certainly not prose (an HTML error page, a serialized stack), and the
 * status sentence is better than a wall of markup.
 */
const MAX_RAW_LENGTH = 400;

/** Markers that give away text written for a log rather than for a person. */
const NOT_PROSE = [
  /<[a-z!/]/i, // HTML or XML: an upstream proxy's error page
  /\bat [\w$.]+ \(/, // a stack frame
  /^\s*[{[]/, // raw JSON that was not the error envelope
  /\b(?:ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EPIPE|ECONNRESET)\b/,
  /\bPrisma\w*Error\b/i,
  /\bQueryFailedError\b/,
];

/**
 * Does this message read as something written for a user?
 *
 * Deliberately a rejection list rather than an allowlist. The API's messages
 * are written by hand and vary in shape, so anything that tries to describe
 * what good prose looks like will reject some of them. Naming the handful of
 * shapes that are definitely NOT prose is both safer and easier to extend when
 * a new one turns up.
 */
function readsAsProse(message: string): boolean {
  if (!message.trim()) return false;
  if (message.length > MAX_RAW_LENGTH) return false;
  return !NOT_PROSE.some((pattern) => pattern.test(message));
}

/**
 * `class-validator` reports one string per broken rule, and a DTO can break
 * several at once. Joined with a space rather than a newline, because this ends
 * up in a toast; the per field detail comes from the form, not from here.
 */
function joinMessage(message: string | string[]): string {
  return Array.isArray(message) ? message.filter(Boolean).join(" ") : message;
}

/** Pull the message out of a parsed body, whatever shape it turned out to be. */
export function extractApiMessage(payload: unknown): string | null {
  if (typeof payload === "string") return payload || null;
  if (!payload || typeof payload !== "object") return null;
  const message = (payload as ApiErrorPayload).message;
  if (message === undefined || message === null) return null;
  const joined = joinMessage(message);
  return joined.trim() ? joined : null;
}

/**
 * The sentence to show a user for a failed request.
 *
 * @param status HTTP status, or 0 when the request never got a response.
 * @param payload The parsed response body, the raw text, or nothing.
 *
 * The API's own wording wins whenever it is usable, because it is specific
 * ("This project already has a client feedback round open" beats "That
 * conflicts with something already saved"). The status sentence is the floor,
 * not the default.
 */
export function humaneError(status: number, payload?: unknown): string {
  const raw = extractApiMessage(payload);
  if (raw && readsAsProse(raw)) return raw;

  const known = STATUS_COPY[status];
  if (known) return known;

  if (!status) return OFFLINE;
  // An unmapped 4xx is a client mistake, so point at the request rather than
  // apologising for the server.
  if (status >= 400 && status < 500) return STATUS_COPY[400];
  return UNKNOWN_FAILURE;
}
