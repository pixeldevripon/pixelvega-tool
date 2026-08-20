# Product requirements: the source documents

The four documents this build implements, kept verbatim as they were handed over. They are the
**source**, not the plan: the plan derived from them is in
[`../dashboard/`](../dashboard/00-requirements.md), which inventories all 178 requirements and says
which the backend already serves.

| Doc                                                          | What it is                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| [`features.md`](./features.md)                               | What the tool does today, plus a named list of what it does not do yet         |
| [`features1.md`](./features1.md)                             | Two earlier drafts of the same scope (Tab 1 v1 scope, Tab 2 capability list)   |
| [`Project Module.md`](./Project%20Module.md)                 | The binding business rules for the project domain, plus its Prisma schema      |
| [`AI Integration Module.md`](./AI%20Integration%20Module.md) | The binding business rules for the three AI features, plus their Prisma schema |

**Do not edit these to reflect decisions.** They are a record of what was asked for, and their value
is that they can be compared against what was built. Where they contradict each other, the conflict
is recorded with a recommendation in
[`../dashboard/00-requirements.md`](../dashboard/00-requirements.md#conflicts-to-resolve); where a
decision has been made, it becomes an ADR under [`../decisions/`](../decisions/).

Moved here from the repository root: `CLAUDE.md` requires every repo-wide document to live under
`docs/`.
