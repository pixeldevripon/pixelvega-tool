# pmt-frontend: CLAUDE.md

The PixelVega PMT dashboard. Next.js 16 App Router, React 19, TypeScript, Tailwind v4.
Pure API client: no database, no Prisma, no secrets. Runs on **:3000**.

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
pnpm dev            # http://localhost:3000
pnpm build
pnpm start          # production bundle on :3000
pnpm lint           # eslint (flat config)
pnpm test           # vitest
npx tsc --noEmit    # typecheck
```

From the repo root, `pnpm dev` boots this and the backend together.

## Environment

`NEXT_PUBLIC_API_URL` is the **backend** base URL: `http://localhost:5050`. The backend is 5050 and
this app is 3000.

`SESSION_GUARD=off` disables `proxy.ts`'s optimistic redirect. It exists for a deployment that puts
the API and the dashboard on unrelated domains, where the session cookie never reaches this app's
server and the guard would redirect every signed-in user to sign in. `.env.example` carries the full
reasoning.

`NEXT_PUBLIC_*` variables are inlined at build time and visible in the browser. Never put a secret
behind that prefix. This app has no server-only secrets today.

## The foundations, as of phase 7

These exist now and new code uses them. There is no second way to do any of them.

| Concern         | Use this                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------- |
| HTTP            | `apiFetch` / `apiDownload` from `lib/api/fetch.ts`. Never `fetch` directly                  |
| Error copy      | `lib/api/humane-error.ts`. An `ApiError.message` is always safe to toast verbatim           |
| Server state    | TanStack Query, through a `hooks/<domain>/use-<domain>.ts` with a key factory               |
| Query defaults  | `components/providers/query-defaults.ts`. 30s stale, two retries, mutations never retried   |
| List state      | `useTableState` from `components/data-table/`. Page, sort, search and filters live in the URL |
| Tables          | `DataTable` and friends from `components/data-table/`. Server-driven: it never sorts a page |
| Permissions     | `usePermissions()` from `contexts/role-context.tsx`. **Never a role string**                |
| Forms           | React Hook Form + Zod, `zodResolver`, one schema per form                                   |
| UI primitives   | `components/ui/`. Add a NEW one with `npx shadcn@latest add <name>`                         |
| Design tokens   | `app/globals.css`. Colour, radius, type scale, tracking and motion. No literals in a class  |
| Session guard   | `proxy.ts`, cookie shape only                                                               |

### Things worth knowing before changing one of them

- **`lib/api/client.ts` is a re-export and nothing else.** It keeps the old `apiRequest` name
  compiling while phase 8 runs. Delete it when nothing imports it; do not add logic to it.
- **`apiFetch` retries 429 and 503, and only for a GET.** A 503 does not say whether a write landed,
  so retrying a POST can create a second record. `shouldRetryQuery` deliberately does NOT retry
  those two statuses again, or three transport attempts would become nine.
- **The `QueryClient` is a module singleton in the browser and fresh per server render.** Not
  `useState`: React discards state from a render that suspends, and there are `<Suspense>`
  boundaries below the provider.
- **`Badge` takes a `tone`, not a `variant`,** and the five tones are the API's closed
  `DISPLAY_TONES` set. This is why the registry's badge is not used: it is keyed on a vocabulary the
  API does not speak.
- **`Button` and `Badge` are hand written on purpose.** The registry's current `radix-nova` style is
  a different design (`h-8` buttons where these are `h-11`). Adopting it is a decision about the
  product's look, not a foundation. `asChild` was added so a link can be a button.
- **`cacheComponents: true` is on.** Runtime data outside a `<Suspense>` boundary fails the build
  rather than silently making the page dynamic. When a build says "Uncached data was accessed
  outside of `<Suspense>`", the fix is a boundary, not the flag.

## What is already right, and should not be changed

- **`page.tsx` files are Server Components, all of them.** Push the `"use client"` boundary *down*,
  never up. The three that were client components (`login`, `forgot-password`, `change-password`)
  were split in phase 7.
- **Route groups** `(auth)`, `(dashboard)`, `(onboarding)` are a clean separation. Keep them.
- **`globals.css` colour values are the product's identity.** Phase 7 added tokens around them and
  changed none of them.
- **`ApiError` with a `status` field.** Roughly a hundred call sites branch on it.

## Known defects the migration has not reached

- **`types/auth.ts`'s `AppUser` disagrees with the API.** Phase 6 made every response enum
  `{ value, label, tone }`, so `role` and `status` are objects. `AppUser` still types them as
  strings, which is why the screens that use it index `roleLabels[user.role]` with an object and
  render an empty badge. `types/users.ts` has the true shape; each screen moves to it in phase 8,
  and `roleLabels` and `lib/auth-meta.ts` are deleted when the last one has.
- **`lib/format.ts`'s `formatEnumLabel` is temporary.** The API now sends the label. It goes when its
  last caller does.
- **`window.setTimeout` in fourteen components.** Harmless (they are all client components) but they
  are the debounce timers and effect deferrals that `useTableState` and TanStack Query replace.

## The answers, written down

These were originally taken from a sibling dashboard repository. That repository is **not** part of
this project and will not be present, so the rules are stated here instead:

| Question                              | Answer                                                                                                                                                                                                    |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| How should the HTTP client look?      | One `lib/api/fetch.ts` wrapping `fetch` with `credentials: 'include'`, throwing an `ApiError` whose `message` is safe to toast verbatim. Raw technical text never reaches a user                            |
| How should a query hook look?         | `hooks/<domain>/use-<domain>.ts`, exporting a key factory. Every query and every invalidation goes through it; inline key arrays drift and silently stop matching                                          |
| How should a list screen decompose?   | `<module>-list-view.tsx` owns state, `<module>-table.tsx` is presentational, `<module>-columns.tsx` defines columns, `<module>-row-actions.tsx` holds the per row menu. Nothing over ~400 lines            |
| How should list state work?           | Page, sort and filters live in one hook and go to the API as query params. The server sorts and filters; the client never re-sorts a page it was given                                                     |
| How should a form look?               | React Hook Form + Zod, `zodResolver`, one schema per form, `z.infer` for the values type. No hand rolled validation state                                                                                  |
| How is the design system enforced?    | Semantic tokens only, checked by ESLint: no numeric palette classes, no raw hex, no inline `style`, no arbitrary values. The lint groups land in phase 8                                                   |
| How is the session guarded?           | The server decides. The UI hides what the response says is not permitted and never re-derives it from a role                                                                                               |

**TanStack Query, not Server Actions, for admin screens.** A dashboard is read heavy, needs cache
invalidation across screens that show the same record, and needs optimistic updates with rollback.
Server Actions give none of those and turn every mutation into a full round trip plus a revalidation.

## Next.js version rules

The `next` package ships agent rules for this exact Next.js version, mirrored into `AGENTS.md` by the
Next.js tooling. They are imported below and take precedence over anything in your training data
about older Next.js versions.

@AGENTS.md
