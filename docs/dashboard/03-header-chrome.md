# The dashboard header chrome

The header's icon row, the activity panel, the notification panel, the profile menu, and the command
palette trigger. Requested by the user with three reference screenshots on 2026-08-20, which are the
specification for the SHAPE. What fills the shapes is whatever PMT's API actually serves.

This is chrome, not a feature phase, so it has its own doc rather than a phase in
[`01-plan.md`](./01-plan.md). The notification items it completes are ticked in
[`02-checklist.md`](./02-checklist.md) under phase D8.

---

## What was asked for

| Screenshot                       | What it shows                                                                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `kc7EBX` header and profile menu | A row of bare icon buttons, then an avatar carrying a presence dot. The menu is an identity block, icon led items, a destructive sign out |
| `M6FPww` the activity panel      | A right hand sheet titled "Activity": a scrolling feed of rows, each an avatar, a sentence, and a relative timestamp                      |
| `ZaN5EP` the notification panel  | A popover: an uppercase "NOTIFICATIONS" title, a count pill, two tabs, and rows carrying a dismiss control and an unread dot              |

A fourth request arrived mid task: **show the keyboard shortcut on the header's search button.**

## What the reference screenshots do NOT decide

The screenshots come from another product and carry its data model: named actors with photographs,
threaded replies, file attachments, tags, and Accept / Decline actions on an invitation.

PMT has none of those on a notification. `NotificationResponseDto` is
`{ id, userId, type: {value,label,tone}, title, message, metadata, readAt, createdAt }`, with no actor,
no avatar, no deep link, and no accept or decline. So:

- **The layout is copied. The content is PMT's.** A row keeps the leading circle, the two lines of
  text, and the meta line. The circle is a tone coloured type icon rather than a photograph, because
  the API does not say who did it.
- **No control is invented for an endpoint that does not exist.** There is no dismiss (no delete
  route), no Accept or Decline, and no notification settings gear. The row's action is mark as read,
  which is the one the API serves.

## The decision worth recording: two surfaces, one dataset

The user asked for an Activity panel and a Notifications panel. PMT has exactly one personal feed
behind both, `GET /notifications`. There is no per user activity endpoint: `ProjectActivity` rows are
written by `ProjectActivityService` and have no controller, and `GET /audit-logs` needs
`VIEW_AUDIT_LOG` and returns raw `action` strings with no display label, so neither can serve a
header panel without breaking D4.

Rather than leave one panel dead, the two are split by **density and purpose**, over one hook and one
row component:

| Surface        | Question it answers     | Query                             | Depth           |
| -------------- | ----------------------- | --------------------------------- | --------------- |
| Bell popover   | What needs me right now | `unreadOnly=true`, and an All tab | First page only |
| Activity sheet | What has happened       | The full list, newest first       | Paginated       |

If a real activity feed is later added to the backend, the sheet moves onto it and nothing else
changes. That is why the sheet reads its rows through the same `NotificationRow` as the bell.

## Spec: what will be TRUE when this is done

**The header**

1. The right hand side of the header is, in order: the search button, an activity button, a
   notification bell, a theme button, and the avatar. Each of the three middle controls is a bare
   round icon button of the same size, with the same hover and the same focus ring.
2. Every icon only control carries an accessible name. The bell's name states the unread count when
   there is one.
3. The theme control is in the header, so the profile menu no longer carries a theme row. One click
   swaps light and dark. It renders nothing theme specific until mounted, so the server's HTML cannot
   disagree with the client's.

**The search button**

4. The button shows a shortcut badge reading `⌘ K` on Apple platforms and `Ctrl K` elsewhere, and the
   badge appears only after mount, because the platform is not knowable on the server.
5. The badge is hidden on small screens, where there is no physical keyboard to press and no room.

**The bell**

6. A dot sits on the bell when the unread count is above zero, and nothing sits on it when the count
   is zero.
7. The unread count is polled in the background. The LIST is not requested until the popover opens.
8. The panel has two tabs. Unread sends `unreadOnly=true`; All sends no such param. Neither tab
   filters in the browser.
9. Clicking a row marks that one read. "Mark all read" marks every one, and is shown only when
   something is unread.
10. After either mutation the list and the count are both invalidated, so the badge and the rows
    cannot disagree.
11. An empty feed says so in one line. A failed load says so in one line, using `ApiError.message`.

**The activity sheet**

12. The activity button opens a right hand sheet titled "Activity", closed by its X, by Escape, and
    by a click outside.
13. Rows arrive in the API's order and are rendered in it. There are no day headings: bucketing rows
    under "Today" and "Yesterday" is grouping in a browser, which D4 puts on the server, and the
    reference panel does not have them either. Each row carries its own relative timestamp.
14. "Load more" appends the next page and is absent on the last page.
15. The bell's footer opens this sheet, and opening it closes the popover.

**The profile menu**

16. The trigger is the avatar alone, with a presence dot, and no chevron.
17. The menu opens with an identity block: avatar, name, email. Then the items, each with a leading
    icon. Then a separator, then Sign out, in the destructive colour with its own icon.
18. Every item points at a route that exists. Sign out clears the query cache before it navigates,
    and `replace`s rather than `push`es.

**Everywhere**

19. Semantic tokens only. No numeric palette class, no raw hex, no inline style, no arbitrary value.
20. No component over 400 lines, and no `.sort()`, `.reduce()` or `.filter()` computing anything a
    response should carry.

## Out of scope, deliberately

- A notifications page or an inbox screen. D8 owns that.
- A delete or dismiss route, an accept or decline action, a notification settings screen, and a
  per notification deep link. All four need backend work that nobody has asked for.
- Anything under `reference-notes/`, which stays quarantined.
- The theme customiser in the fourth screenshot's icon row. PMT has one palette, so a picker would be
  a control with nothing behind it.

## Plan, in order, riskiest first

| #   | File                                       | Why it is in this order                                         |
| --- | ------------------------------------------ | --------------------------------------------------------------- |
| 1   | `types/notifications.ts`                   | Everything below compiles against it                            |
| 2   | `lib/api/notifications.ts`                 | Four calls, matching the controller exactly                     |
| 3   | `hooks/notifications/use-notifications.ts` | The key factory both panels and the badge share                 |
| 4   | `lib/relative-time.ts`                     | `Intl.RelativeTimeFormat`, the one formatting helper this needs |
| 5   | `components/shell/notification-row.tsx`    | The row both panels render                                      |
| 6   | `components/shell/notification-bell.tsx`   | The popover                                                     |
| 7   | `components/shell/activity-sheet.tsx`      | The sheet                                                       |
| 8   | `components/shell/header-icon-button.tsx`  | The one icon button shape                                       |
| 9   | `components/shell/theme-toggle-button.tsx` | Moves the theme control out of the menu                         |
| 10  | `components/shell/header-actions.tsx`      | The client boundary that owns "is the sheet open"               |
| 11  | `components/user-profile-dropdown.tsx`     | Rewritten to the screenshot                                     |
| 12  | `components/shell/site-header.tsx`         | Composition only, no state                                      |
| 13  | `lib/platform.ts`                          | Which modifier key to advertise, as a pure function             |
| 14  | `components/shell/command-palette.tsx`     | The shortcut badge                                              |

### Four things a reader will not expect

**The notification components live in `components/shell/`, not `components/notifications/`.** They
are header chrome, and `eslint.config.mjs` enforces D3: `components/shell/` may import only itself
and the shared folders, so a `components/notifications/` folder would make the header illegal. When
D8 builds an actual notifications SCREEN, that screen gets the module folder, and the row is the piece
to promote to `components/common/` at that point.

**`components/avatar.tsx` is deleted.** Its only caller was the profile menu, which now uses the
reference's own `components/ui/avatar.tsx` primitive, including its `AvatarBadge` for the presence
dot. The deleted file typed its user as `any` and baked a `p-2` into an avatar, which is why the dot
had nowhere to sit.

**The Cmd+H handler in the profile menu is gone.** It called `preventDefault()` on macOS's Hide
Window and opened the dashboard root in a new tab instead. Cmd+/ (jump to your profile) stays, and the
menu now advertises it, which is the reason it was worth keeping.

**`components/shell/mode-toggle.tsx` is deleted.** It was already dead (nothing imported it), and
leaving it beside `theme-toggle-button.tsx` would have put two theme toggles in one folder with only
one of them wired up. Its sun-to-moon rotate transition is worth stealing if this one ever wants it,
and it is in the history.

**What could break, and what catches it.** The count badge and the rows drifting apart is the real
risk, and the invalidation test catches it. A hydration mismatch on the theme button and the shortcut
badge is the second, and both are gated on `mounted`, asserted by the palette spec. A regression in
the header is otherwise visible immediately: it is on every authenticated screen.

## Checklist

Tick from evidence, in the same PR.

### Data layer

- [x] `types/notifications.ts`, field for field against `notifications/dto/notification.dto.ts`
- [x] `lib/api/notifications.ts`: `list`, `unreadCount`, `markRead`, `markAllRead`, through `apiFetch`.
      Pinned by `lib/api/notifications.test.ts`, 7 cases, including that "all" OMITS `unreadOnly`
      rather than sending `false` at a `@ToBoolean()` param
- [x] `hooks/notifications/use-notifications.ts` exports `notificationKeys` and every query and
      invalidation goes through it
- [x] The unread count polls (`refetchInterval`); the list is gated on the panel being open, asserted
      by "fires NOTHING while the panel is closed"
- [x] Both mutations invalidate the whole `['notifications']` root, so the list and the count cannot
      disagree. Asserted with the key they were called with

### The header

- [x] `header-icon-button.tsx`: one shape, one hover, one focus ring, and `label` is a required prop
      rather than an optional one
- [x] Glyphs are **20px**, the same as the sidebar's nav icons, so the shell speaks one icon size.
      They were briefly taken down to 16px to match the search trigger's magnifier, and the user put
      them back: a bare control carrying its meaning alone can afford to be a step larger than a
      labelled field. The 36px hit area never changed
- [x] The glyphs are `Pulse01Icon`, `Notification01Icon` and `Sun03Icon` / `GibbousMoonIcon`, chosen
      by the user. The first pass used `Notification03Icon`, which is a bell JAR and does not read as
      a bell at all, and `PulseIcon`, whose waveform is flatter than `Pulse01`'s. `GibbousMoonIcon`
      is a full circle with the crescent cut into it, so it holds the same round footprint as the
      bell rather than hanging in a corner of its own button. Of the three, the bare pulse stroke is
      the optically lightest, since it is wide and short where the other two fill a circle
- [x] `theme-toggle-button.tsx` in the header, gated on `mounted`
- [x] The theme row is gone from the profile menu
- [x] `site-header.tsx` holds no state and needs no `use client`. `header-actions.tsx` owns the one
      piece of shared state ("is the activity sheet open"), which is why it is a client component

### The bell

- [x] A dot only when the unread count is above zero, and the count is in the accessible name
- [x] Two tabs, both server filtered. Asserted by the params the second tab sends
- [x] Row click marks one read; "Mark all read" appears only when something is unread
- [x] Empty state (worded per tab), error state (the API's own message), loading skeleton
- [x] Footer opens the activity sheet and closes the popover

### The activity sheet

- [x] Right hand sheet titled "Activity", using `SheetContent`'s own unmodified dismissal (its X,
      Escape, outside click). Nothing here overrides it
- [x] Rows render in the API's order, with no client side grouping and no day headings
- [x] "Load more" appends the next page, and is absent on the last one

### The profile menu

- [x] Identity block: avatar, name, email
- [x] Icon led items, every one pointing at a route that exists (today that is `/profile`, alone)
- [x] Destructive sign out with an icon, cache cleared before `router.replace`. The ORDER is asserted
      through `invocationCallOrder`, not just the two calls

### The palette trigger

- [x] `⌘ K` on Apple platforms, `Ctrl K` elsewhere, after mount only
- [x] Hidden below the `md` breakpoint (`hidden md:inline-flex`), where the trigger is icon only

### Tests

- [x] The hooks: the query key, the params each tab sends, and both invalidations. 12 cases
- [x] The bell: the badge appears and disappears on the count, and the aria label states it. 12 cases
- [x] The row: unread styling and the mark read call, asserted with the id it was called with. 5 cases
- [x] The palette: the platform specific label. 4 cases
- [x] Also covered, beyond the plan: the activity sheet (10 cases) and the profile menu (11 cases)

### The gate

- [x] `pnpm lint`: 0 errors, 2 warnings, both inherited (`quick-edit-sheet.tsx`, `data-table.tsx`)
- [x] `npx tsc --noEmit`: clean
- [x] `pnpm test`: 16 files, 164 tests, all passing (48 of them added here)
- [x] `pnpm build`: succeeds, partial prerendering intact
- [x] `pnpm gate:contrast`: GATE GREEN
- [ ] `pnpm test:e2e`: **not run, and not runnable.** Every spec under `e2e/tests/` visits a route of
      the reference product's deleted domain (`/trips`, `/hubs`, `/categories`, ...), so the suite
      fails wholesale before it reaches anything in this change. The first PMT e2e spec is a D0 item
