# Overview redesign: the project board first, everything else smaller

The overview shipped as a wall: four tall tiles, a wide chart, then three rows of three cards, then a
twelve-card project grid at the bottom. Every figure on it was correct and almost none of it was
scannable, because the thing a reader opens the dashboard for (what is the work, and where is it) sat
below four screens of aggregate.

This inverts it. The board leads, the aggregates support it, and every number on the page is a door.

## Spec: what is TRUE when this is done

1. **The board leads.** The first section of the overview is a project board: one column per
   lifecycle phase, cards inside it. Everything else renders below.
2. **Four phases, not ten statuses.** `To do · In progress · In review · Closed`. The ten
   `ProjectStatus` members map onto them exactly once each, and the mapping lives in the backend
   because it is a business grouping (D4).
3. **A column header carries the phase's TRUE total**, across every project the caller may see, not
   the number of cards under it. A column with more than it shows carries a `+N more` link.
4. **A board card carries** the priority badge, the name, the description clamped to two lines, an
   avatar stack of up to four members with a `+N` chip, and a metric row of blockers, hours and
   progress.
5. **Smaller secondary cards.** The headline figure drops from `text-2xl` to `text-xl` and loses its
   sparkline (the chart below owns the trend). Queues, standups, leaderboards and breakdowns move to
   `size='sm'` with `text-sm` titles.
6. **A card is as tall as what is in it.** Nothing stretches to match a taller neighbour.
7. **Every item is a door.** Each headline tile, each queue row, each breakdown slice, each ranked row
   and each board column links to the screen that holds the detail behind it.
8. **No link points at a route that does not exist.** A destination whose screen is not built renders
   as plain text carrying the same number, and the registry that decides this is one file.
9. **A block the caller may not see is ABSENT, not empty**, and the backend decides it from the
   caller's permission set:

   | Block                    | Gate                                  |
   | ------------------------ | ------------------------------------- |
   | `hoursLogged` tile       | `VIEW_TIME_ENTRIES`                   |
   | `topProjectsByHours`     | `VIEW_TIME_ENTRIES`                   |
   | `openBlockers` tile      | `VIEW_BLOCKERS`                       |
   | `blockerBreakdown`       | `VIEW_BLOCKERS`                       |
   | `standupComplianceToday` | `VIEW_WORK_REPORTS`                   |
   | `topContributors`        | ADMIN or MANAGER audience (unchanged) |
   | `myDay`                  | `TRACK_PROJECT_TIME` (unchanged)      |

   For the six roles that exist today this changes nothing a role can see: every internal role already
   holds all three permissions and a CLIENT gets the client block. What it changes is that the rule is
   now stated in code and enforced server-side, instead of being an assumption about who ever reaches
   the endpoint.

10. **`atRisk` counts every at-risk project in scope.** It counted only the twelve that fit on the old
    grid, so a workspace with thirty at-risk projects reported twelve.
11. **`?phase=` filters the projects list** to exactly the statuses in that phase, so the column
    header's link lands on the same set of projects the column counted.
12. **Nothing on the frontend sorts, filters, groups, counts or aggregates API data** (D4).

### Out of scope, deliberately

- **`/projects/[id]`, the board card's destination, is not built.** It is not built today either: the
  projects list, board and timeline all link to it. This change does not add the screen and does not
  pretend the link works.
- Drag and drop on the board. Moving a card is a status change with its own permission and its own
  audit entry, so it belongs on the project rather than in a gesture that is easy to make by accident.
- The ten unbuilt screens. `/time`, `/my-day`, `/requirements`, `/reviews` and `/client-feedback` stay
  absent, which is exactly why item 7 exists.

## Plan, riskiest first

The frontend is a pure function of the response, so the response is settled first.

| #   | File                                        | What                                                            |
| --- | ------------------------------------------- | --------------------------------------------------------------- |
| 1   | `projects/project-phase.ts` (new)           | The phase concept: statuses per phase, labels, tones, `phaseOf` |
| 2   | `projects/spec/project-phase.spec.ts` (new) | Every status in exactly one phase, checked                      |
| 3   | `projects/dto/project.dto.ts`               | `phase?` on both project queries                                |
| 4   | `projects/projects.service.ts`              | `buildProjectFilters` intersects `phase` with `status`          |
| 5   | `dashboard/dto/dashboard.dto.ts`            | The board DTOs, `description`, the nullable blocks              |
| 6   | `dashboard/dashboard.mapper.ts`             | `toProjectBoard`, `description` on the card                     |
| 7   | `dashboard/dashboard.service.ts`            | Per-phase selection, phase totals, the `atRisk` fix, the gates  |
| 8   | `lib/config/deep-links.ts` (new, frontend)  | One registry: href, permissions, and whether the route exists   |
| 9   | `components/home/project-board*.tsx` (new)  | The board and its card                                          |
| 10  | The card kit                                | Smaller, and linkable                                           |

**What could break, and what catches it.** Removing `workspace.projects` in favour of the board is the
one breaking change to the response; `tsc` catches every consumer, and the openapi e2e spec catches a
2xx that lost its schema. The `atRisk` fix changes a number a spec asserts, which is the point: the old
assertion encoded the bug.

## What looking at it changed

The plan survived contact with a rendered page; several of its details did not. Everything below was
found by looking at the screen, or by the user looking at it, and none of it by a passing test.

### The board

**It takes the whole width.** Columns were fixed-width flex children at `17.5rem`, which left a
quarter of a wide screen empty beside the fourth lane. They are now an implicit-column grid:
`grid-flow-col` with `auto-cols-[minmax(17.5rem,1fr)]`. `1fr` spends the row on however many columns
arrived, and the floor is what makes it overflow into a scroller on a narrow screen rather than
crushing four lanes into slivers. The column count is not hardcoded, so a fifth phase would fit.

**Cards are taller and have an even floor.** `p-4` rather than `p-3`, and the description slot is
always rendered at `min-h-8` even when there is no description, so two cards side by side keep the
same height instead of one being two-thirds of the other. Nothing is written into an empty slot: no
"No description", no em dash.

**An at-risk card is not tinted.** `isAtRisk` painted the whole card in the danger surface, and
because a Critical or Urgent project is usually also overdue or blocked, nearly every high-priority
card came out pink and the tint stopped distinguishing anything. The badges say "Critical" and "On
hold" in words, and the risk still shows where it is specific: the deadline line goes red with an
alert glyph, and a high-severity blocker count goes red. `isAtRisk` is still the one flag any COUNT of
at-risk work derives from; it no longer colours a card.

**The avatars keep their overlap.** The stack was rebuilt without it after "images are cropped", and
the overlap turned out not to be the problem: a `min-w-0 overflow-hidden` wrapper, added to stop the
hours label wrapping, was shaving the rightmost face in half. The wrapper lost its `overflow-hidden`,
the stack kept its overlap and went from `size-6` to `size-7`, and `pr-1` leaves room for the last
avatar's ring, which is drawn outside the box.

### One grid for the whole page

Everything below the board is on the same four-column grid as the board's four lanes, spanning within
it: the four tiles take one each, "Needs attention" and the two ranked lists take two, the hours chart
takes two. One set of gridlines runs down the page instead of a three-column row sitting under a
four-column one.

**Rows match top and bottom**, which is a grid's default stretch. Neither `items-start` nor `h-full`
appears anywhere in the view now, and that is the point: `h-full` is `height: 100%` of a grid area
whose height is already the tallest item, so it did nothing but hide where the stretching came from.

Getting to matched rows that do not contain holes meant shrinking CONTENT, not adjusting alignment:

- **`aspect-video` on `ChartContainer` was making the chart the tallest thing on the page.**
  Sixteen-by-nine reads as a ratio until the card is two thirds of a wide screen: at 945px across it
  made the chart 531px tall and dragged its whole row with it. `aspect-auto` fixes the blowup;
  `flex-1 h-full min-h-48` keeps the growth, which is right for the one element on the page that reads
  better with more height.
- **The status breakdown's ten legend rows collapse after five.** `collapseAfter` on `BreakdownCard`,
  behind a "5 more" toggle. Slicing a list to render it is presentation, not derivation: the server
  decided the order, the counts and the shares, the ring still draws every slice, and no number
  changes. The ring stayed, on the user's call, after a stacked bar was tried and rejected.
- **"My day" lost its sparkline.** It was the tallest card in its row at 433px, holding "Needs
  attention" and "Standups today" open with a hole in each. `myHoursTrend` still arrives and every
  figure it summarised is still on the card as a number; the page's real trend is the team's hours
  chart lower down. Nothing had asserted the sparkline was there, so removing it broke no test, which
  is why a test now pins its absence.
- **The headline tiles lost theirs too**, and their figure dropped from `text-2xl` to `text-xl`.

Measured on the admin dashboard, before and after:

| Row                                 | Was       | Now            |
| ----------------------------------- | --------- | -------------- |
| Headline tiles                      | ~180 each | 150, all equal |
| My day / Needs attention / Standups | 433 each  | 372, all equal |
| Hours chart / status / severity     | 962       | 458, all equal |
| Top projects / Busiest people       | 348       | 348, all equal |
| Whole page                          | ~3400     | 2469           |

## Two defects the render found, which the tests had not

**A finished project read "138 days overdue".** A completed project keeps its deadline, so
`deadlineLabel` still counts, and `isOverdue` is deliberately false for terminal work, so neither
field could tell a card to drop the line. The board printed "93 days overdue" in grey under a
CANCELLED project, which reads as live work that is very late. `isTerminal` now ships on the dashboard
card (the mapper already computed it and threw it away) and the card guards on it, exactly as the
projects board always did.

**"87h 42m" broke across two lines.** Three metrics beside an avatar stack overflowed a 280px card.
The metrics are now `shrink-0 whitespace-nowrap`, which is what actually holds the line.

## Not fixed here, and why

**`/projects/[id]` does not exist**, so a board card's link 404s. It 404s from the projects list,
board and timeline too: this change neither adds the screen nor pretends the link works, and it is the
strongest candidate for the next piece of work. Every OTHER destination on the overview is checked by
`lib/config/deep-links.test.ts` against the list of routes that exist, so no new dead link shipped.

**`pmt-backend/.env.example` requires `SEED_ADMIN_EMAIL` and `SEED_ADMIN_NAME` that are not in it.**
`src/env.validate.ts` demands both and the example file names neither, so the backend cannot boot from
a clean checkout. Found while restarting the API to verify this change, unrelated to it, and left
alone because that file was being edited in parallel while this work ran.
