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

## Reference implementation

`../../tripwheel-x-islandtours-dashboard/` is the same kind of app (a role-gated admin CRM calling a
NestJS API with a better-auth cookie) built to the target architecture. Read it rather than guessing:

| Question | File |
|---|---|
| How should the HTTP client look? | `lib/api/fetch.ts`, `lib/api/humane-error.ts` |
| How should a query hook look? | `hooks/categories/use-categories.ts` |
| How should a list screen decompose? | `components/categories/*` |
| How should list state work? | `components/data-table/use-table-state.ts` |
| How should a form look? | `components/categories/category-form.tsx` |
| How is the design system enforced? | `eslint.config.mjs` |
| How is the session guarded? | `proxy.ts` |

`../../island-tour-development/frontend/DASHBOARD-PATTERNS.md` is the written version of those rules,
including why TanStack Query is preferred over Server Actions for admin screens.

## Next.js version rules

The `next` package ships agent rules for this exact Next.js version, mirrored into `AGENTS.md` by the
Next.js tooling. They are imported below and take precedence over anything in your training data
about older Next.js versions.

@AGENTS.md
