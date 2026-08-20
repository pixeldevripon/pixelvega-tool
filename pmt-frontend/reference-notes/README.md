# Reference notes: temporary, delete at the end of the prune

`pmt-frontend` is a verbatim copy of `tripwheel-x-islandtours-dashboard`. The rule for this build is:

> **Design, data fetching, animation and rendering strategy come from the reference. Features and
> pages come from `docs/dashboard/00-requirements.md`.**

This folder holds the two things that copy displaced, kept only so nothing is lost while the prune
runs. **Every file here is deleted in the last step of phase D0.** Nothing in `app/`, `components/`,
`hooks/`, `lib/` or `types/` may import from it.

| Path                         | What it is                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.reference.md`        | The reference repo's own `CLAUDE.md`. Describes another product's three repos and push remotes. Read it for the cross-repo coupling notes, then delete |
| `README.reference.md`        | The reference's README: how it runs, its two token systems, its auth. The best single description of the patterns being mirrored |
| `TEST-AND-HARDENING-CHANGELOG.md` | The reference's hardening log. Records defects already fixed there, so we do not reintroduce them        |
| `proxy.pmt.ts`               | PMT's own route guard and cookie shape, from refactor phase 7. The reference's `proxy.ts` is the pattern; this file is the PMT specifics to fold into it |
| `types-pmt/`                 | PMT's verified API types: `permissions.ts` (59 permissions, checked against the published enum), `auth.ts`, `users.ts` |
| `contexts-pmt/`              | PMT's `RoleProvider`, which reads `GET /users/me/permissions`. Replaces the reference's static role map        |
| `lib-pmt/`                   | PMT's `apiFetch`, `humaneError` and their specs. Two defects were already fixed here: a caller-supplied abort signal silently disabling the 15 second timeout, and `JSON.parse` throwing a `SyntaxError` out of the client on a non-JSON error body |

## Further reading, outside this repo

The reference's own planning documents were deliberately not copied in, because they describe another
product. They are the clearest statement of the patterns being mirrored, so read them in place:

`../../tripwheel-x-islandtours-dashboard/dashboard-extraction/`

| File                              | Why it matters here                                        |
| --------------------------------- | ---------------------------------------------------------- |
| `03-DESIGN-SYSTEM-SPEC.md`        | The token system, the two-mode ramps, the contrast gate     |
| `04-UX-STRATEGY-SPEC.md`          | Navigation grouped by task frequency, and per-role IA       |
| `05-COMPONENT-ARCHITECTURE-SPEC.md` | The component split every module folder follows            |
