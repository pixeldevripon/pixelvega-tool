/**
 * The maximum length of every free text field that reaches the database (D5).
 *
 * ── Why these exist at all ──
 * Without a bound, `description` accepts a fifty megabyte string. Postgres
 * `text` will store it, every list query that selects it then reads it, and the
 * Slack and AI paths forward it to a third party that charges by the token. A
 * bound is the cheapest possible guard against all three, and it produces a
 * clear 400 rather than a timeout.
 *
 * ── Why they are named rather than inline ──
 * The same kind of field should accept the same length everywhere. A
 * `description` bounded at 5,000 in one module and 2,000 in another is a bug
 * report waiting to happen, and inline numbers are how that happens.
 */

/** A name, title, or label. Long enough for a real project name. */
export const SHORT_TEXT = 200;

/**
 * One line of free text: a designation, a source channel, a search term.
 *
 * Also the ceiling for an opaque identifier from an external system, such as a
 * Slack channel id or a better-auth user id, which are far shorter than this in
 * practice but are not ours to bound tightly.
 */
export const SINGLE_LINE = 500;

/**
 * A paragraph or several: a description, a reason, a resolution note, a plan.
 *
 * 5,000 characters is roughly two pages, which is more than anyone has typed
 * into any of these fields and well short of a payload worth worrying about.
 */
export const LONG_TEXT = 5_000;

/**
 * A document: pasted credentials, an AI template body.
 *
 * These are the only fields meant to hold something of real size, and the
 * template content in particular goes straight into a system prompt, so the
 * bound is also a token budget.
 */
export const DOCUMENT_TEXT = 50_000;

/** RFC 5321 caps an address at 254 characters. */
export const EMAIL = 254;

/**
 * A password.
 *
 * Bounded because hashing is deliberately expensive: an unbounded password is a
 * way to make the server do unbounded work on an unauthenticated route.
 */
export const PASSWORD_MAX = 128;
