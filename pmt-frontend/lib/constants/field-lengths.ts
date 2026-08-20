/**
 * The maximum length of every free text field, mirrored from the backend.
 *
 * Source of truth: `pmt-backend/src/common/constants/field-lengths.ts` and the
 * `@MaxLength()` decorators on each DTO. These exist here so a form can show
 * "keep this under N characters" before a round trip, and they are a
 * CONVENIENCE, never the gate (D5): the API validates every one of them again.
 * Where the two disagree the backend is right and this file is the bug.
 *
 * ── The shared bounds, named exactly as the backend names them ──
 */

/** A name, title, or label. Long enough for a real project name. */
export const SHORT_TEXT = 200;

/** One line of free text: a designation, a source channel, a search term. */
export const SINGLE_LINE = 500;

/** A paragraph or several: a description, a reason, a resolution note, a plan. */
export const LONG_TEXT = 5_000;

/** A document: pasted credentials, an AI template body. */
export const DOCUMENT_TEXT = 50_000;

/** RFC 5321 caps an address at 254 characters. */
export const EMAIL = 254;

/**
 * A password. Bounded because hashing is deliberately expensive: an unbounded
 * password is a way to make the server do unbounded work on an unauthenticated
 * route.
 */
export const PASSWORD_MAX = 128;

/**
 * ── Per-field bounds that are tighter than the shared ones ──
 *
 * These come from the `@MaxLength()` on the specific DTO property rather than
 * from a shared constant, so they are named for the field rather than for the
 * shape of the text. Read them off `profiles/dto/profile.dto.ts` when changing.
 */
export const PROFILE_NAME = 120;
export const PROFILE_DESIGNATION = 120;
export const PROFILE_PHONE = 40;
export const PROFILE_TIMEZONE = 64;
export const PROFILE_BIO = 2_000;
export const CLIENT_COMPANY_NAME = 160;
