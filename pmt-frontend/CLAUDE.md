# pmt-frontend: CLAUDE.md

The PixelVega PMT dashboard. Next.js 16 App Router, React 19, TypeScript, Tailwind v4.
Pure API client: no database, no Prisma, no secrets. Runs on **:3001**.

> **Read the root `CLAUDE.md` first.** It carries the frontend rules (server/client boundary, data
> fetching, module file structure, forms, styling, dependency direction) that apply here. This file
> only adds what is specific to running and navigating this package.
>
> The target architecture and the migration plan are under `../docs/`, indexed by
> `../docs/README.md`. The five binding directives are in `../docs/architecture/02-directives.md`.
> Much of this app predates that target. Write new code to the target; do not silently match the old
> pattern because it is what is next to you.

## Commands

```bash
pnpm dev            # http://localhost:3001
pnpm build
pnpm start          # production bundle on :3001
pnpm lint           # eslint (flat config)
npx tsc --noEmit    # typecheck
```

From the repo root, `pnpm dev` boots this and the backend together.

## Environment

`NEXT_PUBLIC_API_URL` is the **backend** base URL: `http://localhost:3000` in development. Note that
3000 is the backend and 3001 is this app. `.env.example` currently says 3001, which is wrong and is
fixed in Phase 1 of the refactor plan; `.env.local` has the correct value.

`NEXT_PUBLIC_*` variables are inlined at build time and visible in the browser. Never put a secret
behind that prefix. This app has no server-only secrets today.

## Current state, and where it is going

| Concern | Today | Target |
|---|---|---|
| Server state | `useEffect` + `fetch` + `useState` in each view (372 `useState` across the app) | TanStack Query hooks in `hooks/<module>/` |
| HTTP | `lib/api/client.ts` (`apiRequest`, browser-only: it calls `window.setTimeout`) | `lib/api/fetch.ts` with retry and `humane-error.ts` |
| Components | one large client component per page, up to 3,339 lines | `-list-view` / `-table` / `-columns` / `-row-actions` / `-form` / `-delete-dialog` |
| Forms | hand-rolled `useState` per field | React Hook Form + Zod |
| UI kit | hand-copied primitives, no `components.json` | shadcn CLI |
| List state | per-screen `useState` + manual debounce + `latestRequestRef` | `useTableState` (URL-synced) |
| Auth | client-side only, after the shell renders | `proxy.ts` cookie-shape guard, then layout validation |
| Tests | none | Vitest + Testing Library, Playwright for E2E |

## What is already right, and should not be changed

- **`page.tsx` files are Server Components.** Every route under `app/(dashboard)/` correctly keeps
  the page as a server component that renders a client view. Keep it that way, and push the
  `"use client"` boundary *down*, never up.
- **Route groups** `(auth)`, `(dashboard)`, `(onboarding)` are a clean separation. Keep them.
- **`globals.css` semantic tokens.** The colour values are the product's identity. The refactor adds
  radius, type-scale, and motion tokens; it does not change the palette.
- **`ApiError` with a `status` field.** Callers branch on it. The new `apiFetch` keeps the same shape.

## The answers, written down

These were originally taken from a sibling dashboard repository. That repository is **not** part of
this project and will not be present, so the rules are stated here instead:

| Question | Answer |
|---|---|
| How should the HTTP client look? | One `lib/api/fetch.ts` wrapping `fetch` with `credentials: 'include'`, throwing an `ApiError` whose `message` is safe to toast verbatim. Raw technical text never reaches a user |
| How should a query hook look? | `hooks/<domain>/use-<domain>.ts`, exporting a key factory. Every query and every invalidation goes through it; inline key arrays drift and silently stop matching |
| How should a list screen decompose? | `<module>-list-view.tsx` owns state, `<module>-table.tsx` is presentational, `<module>-columns.tsx` defines columns, `<module>-row-actions.tsx` holds the per row menu. Nothing over ~400 lines |
| How should list state work? | Page, sort and filters live in one hook and go to the API as query params. The server sorts and filters; the client never re-sorts a page it was given |
| How should a form look? | React Hook Form + Zod, `zodResolver`, one schema per form, `z.infer` for the values type. No hand rolled validation state |
| How is the design system enforced? | Semantic tokens only, checked by ESLint: no numeric palette classes, no raw hex, no inline `style`, no arbitrary values |
| How is the session guarded? | The server decides. The UI hides what the response says is not permitted and never re-derives it from a role |

**TanStack Query, not Server Actions, for admin screens.** A dashboard is read heavy, needs cache
invalidation across screens that show the same record, and needs optimistic updates with rollback.
Server Actions give none of those and turn every mutation into a full round trip plus a revalidation.

## Next.js version rules

The `next` package ships agent rules for this exact Next.js version, mirrored into `AGENTS.md` by the
Next.js tooling. They are imported below and take precedence over anything in your training data
about older Next.js versions.

@AGENTS.md
