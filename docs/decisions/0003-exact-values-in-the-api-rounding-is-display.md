# 0003. The API carries exact values; rounding is display, except where it is reported

**Status:** accepted
**Date:** 2026-08-20

## Context

The frontend has nine `formatMinutes` and `formatHours` call sites, some of which
round. The question was whether that rounding is a display concern or a business
rule.

Looking at what the backend already does: `TimeEntry.durationMinutes` is an exact
integer, `Project.actualHours` is `sum(durationMinutes) / 60` unrounded, and the
report services round derived figures to two decimal places
(`Math.round((minutes / 60) * 100) / 100`).

## Decision

**Three tiers, and the distinction between them is what matters.**

1. **Stored values are exact.** `durationMinutes` is an integer count of minutes.
   Nothing rounds on the way in.

2. **Derived values in a response are computed server side, at a documented
   precision, and are part of the contract.** `actualHours`, `remainingHours`, a
   compliance percentage: the server decides the precision, states it, and every
   consumer sees the same number. Two decimal places for hours, as the report
   services already use.

3. **Formatting is the client's, and must never feed a calculation.**
   `formatMinutes(450)` producing `"7h 30m"` is presentation. What is forbidden is
   parsing that string back, or summing already rounded values.

The rule underneath: **round once, as late as possible, and never round a number
that something downstream will use.** A total is summed from exact minutes and
then rounded, never summed from rounded parts. That is where this class of bug
actually comes from, and it is why the aggregation work in phase 6 must move to
the server rather than being tidied up in the client.

The API therefore carries **both** where they differ: `totalMinutes` (exact,
integer) alongside `totalHours` (derived, 2dp). A client displaying hours uses
`totalHours`; anything computing uses `totalMinutes`.

## Consequences

**Easier.** No drift between two clients showing the same figure. Sums are
correct by construction, because they are taken over exact minutes.

**Harder.** Two fields where one looks sufficient. That redundancy is deliberate
and should be documented on the DTO so the next reader does not remove one.

**Ruled out.** Summing rounded values. Parsing a formatted string. A client
deriving hours from minutes itself, which would reintroduce a second rounding
rule.

**Action for phase 6:** audit the nine call sites. Any that round and then
compare or sum are bugs today, and their number moves server side. Any that round
purely to render stay in `lib/format.ts`.
