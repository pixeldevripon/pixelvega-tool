# 0001. Enum responses carry value, label and tone

**Status:** accepted
**Date:** 2026-08-20

## Context

The frontend derives display text and severity from raw enum values:

```ts
formatEnumLabel("READY_FOR_WORK")  // "Ready For Work"
formatEnumLabel("AI_SUMMARY")      // "Ai Summary"

function getStatusTone(status) {
  if (status === "COMPLETED") return "success";
  if (status === "ON_HOLD" || status === "WAITING_FOR_FEEDBACK") return "warning";
  ...
}
```

Directive D4 says this belongs to the backend. The question raised was whether
`label` in particular should be server supplied, since it hardcodes English into
the API and most public APIs deliberately do not do that: Stripe returns
`status: "requires_payment_method"`, GitHub returns `state: "open"`, and the
caller supplies its own wording.

## Decision

Every enum in a response is an object with three fields:

```json
{ "value": "READY_FOR_WORK", "label": "Ready for work", "tone": "primary" }
```

The three are not equal in status, and that distinction is the decision:

- **`value` is canonical.** Machine readable, stable, and the only field a client
  may branch on. Anything keying off `label` is a bug.
- **`tone` is domain knowledge and belongs to the server.** Deciding that waiting
  on a client is a warning while being on hold is equally bad is a judgment about
  the business, not a styling choice. Two clients must not be free to disagree
  about it. The vocabulary is a small closed set: `default`, `primary`,
  `success`, `warning`, `danger`.
- **`label` is an advisory default.** The server supplies it so that every client
  gets correct wording for free, and so a second consumer does not have to
  reimplement the vocabulary. A localized client is free to ignore it and key its
  own translation off `value`.

The public API convention (return the enum, let the caller word it) is right for
a public API with many unknown consumers in many locales. This is an internal,
single locale admin API with one consumer, where the cost of that convention is
paid immediately and the benefit never arrives. The rule of thumb underneath both
positions is the same: **the server owns meaning, the client owns presentation.**
`tone` is meaning. `label` is presentation the server happens to be well placed to
default.

## Consequences

**Easier.** `formatEnumLabel` and both tone functions are deleted, along with the
"Ai Summary" class of bug. A second consumer, a mobile client or an export, gets
consistent wording without re-deriving anything. Renaming a status in the product
is a server change alone.

**Harder.** Response payloads grow: an enum field becomes three fields. Adding a
locale later means adding `Accept-Language` handling on the server rather than
shipping a client side dictionary.

**Ruled out.** Clients branching on `label`. Any client side severity map. Both
should fail review.

**Migration is non breaking if done additively:** add the object alongside the
existing scalar field, migrate the client, then remove the scalar.
