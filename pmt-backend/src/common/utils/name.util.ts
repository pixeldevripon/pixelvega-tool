/**
 * Keeping `User.name` and the `firstName` / `lastName` pair in step.
 *
 * The account screen edits two fields; every other table, email and audit row
 * reads one. Rather than deriving the full name at read time (30-odd queries
 * select it, and none of them should have to know it is computed), both
 * representations are stored and every write path passes through here.
 *
 * Two rules, and they are inverses:
 * - write either half -> recompose `name`
 * - write `name` -> re-split the halves
 *
 * Miss either one and the account form opens showing a name the rest of the app
 * disagrees with.
 */

/** The two halves, as stored. Either may be absent. */
export interface NameParts {
  firstName: string | null;
  lastName: string | null;
}

/**
 * `"Jabed"` + `"Hossain"` -> `"Jabed Hossain"`.
 *
 * Returns null when both halves are empty, which the caller reads as "there is
 * nothing to write". `User.name` is NOT NULL, so clearing both fields must leave
 * the existing name alone rather than blanking it: a person with no name is a
 * row nothing can render.
 */
export function joinName(parts: NameParts): string | null {
  const joined = [parts.firstName, parts.lastName]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part.length > 0)
    .join(' ');
  return joined.length > 0 ? joined : null;
}

/**
 * `"Jabed Hossain Khan"` -> `{ firstName: 'Jabed', lastName: 'Hossain Khan' }`.
 *
 * Split on the FIRST space, matching the backfill in
 * `20260820180000_add_account_profile_fields`. A last-space split reads equally
 * plausible in English and is wrong wherever the family name comes first. No
 * split is right for every name, which is why both halves stay editable: this
 * only has to produce a sensible starting point, not a correct parse.
 *
 * A single word is a first name with no last name, never the same word twice.
 */
export function splitName(name: string): NameParts {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (trimmed.length === 0) {
    return { firstName: null, lastName: null };
  }
  const separator = trimmed.indexOf(' ');
  if (separator === -1) {
    return { firstName: trimmed, lastName: null };
  }
  return {
    firstName: trimmed.slice(0, separator),
    lastName: trimmed.slice(separator + 1),
  };
}
