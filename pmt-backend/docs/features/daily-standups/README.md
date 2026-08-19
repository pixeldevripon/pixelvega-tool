# Daily Work Report & Real-Time Blockers Feature

Documentation for two **independent**, already-shipped systems:

1. **Daily Work Reports** — What developers plan & accomplish each day
2. **Real-Time Blockers** — Project blocking issues tracked continuously

Both are implemented, merged to `main`, and live flat inside `src/modules/projects/` (see `ARCHITECTURE_NOTES.md` §7 for why neither got its own module). Slack posting for both shipped later as a separate feature — see `docs/features/slack-integration/`.

---

## 📚 Documentation Structure

### 1. **DESIGN.md**
The complete specification, describing the actual shipped implementation:
- Real schema, endpoints, service/controller layout, DTOs
- Slack integration summary (full detail lives in `slack-integration/DESIGN.md`)
- Business rules
- §12 records exactly what changed between the original pre-build design and what shipped

**Read this if**: You want to understand *what* is built.

---

### 2. **IMPLEMENTATION_CHECKLIST.md**
The as-built checklist for both features — everything is checked off except unit tests (this backend has none yet, for any feature).

**Read this if**: You want a line-by-line account of what was built and where.

---

### 3. **ARCHITECTURE_NOTES.md**
Patterns actually used in the shipped code:
- Edit-window logic (state-based for plans, time-based for wrap-ups, none for blockers)
- Real code excerpts from `daily-work-report.service.ts` / `blocker.service.ts`
- Why Slack posting is a direct fire-and-forget call, not a queue
- Common pitfalls

**Read this if**: You're extending this feature and want to match existing patterns.

---

## 🔄 Two Independent Systems

### Daily Work Reports (One per Day)
```
Morning:  Plan          — mandatory before wrap-up, editable anytime until wrap-up exists
Evening:  Wrap-Up       — editable for 2 hours after submission, then locked
PM Review: per-entry review, only once the report is COMPLETED
Tied to:  one specific date, one developer
```

### Real-Time Blockers (Continuous)
```
Created:  anytime, by an active member of the project (or ADMIN/SYSTEM_ADMIN)
Editable: anytime until RESOLVED
Locked:   once RESOLVED — terminal, no override
Tracked:  until RESOLVED, can span multiple days
NOT tied to any specific daily report
```

---

## 📋 API Summary (as implemented)

### Daily Work Reports
```
POST   /api/daily-work-reports                                    → submit plan
PATCH  /api/daily-work-reports/:id/plan                            → update plan
GET    /api/daily-work-reports/today                                → today's report
GET    /api/daily-work-reports                                      → list across projects (self, or PM/Admin viewing anyone)
POST   /api/daily-work-reports/:id/wrap-up                          → submit wrap-up
PATCH  /api/daily-work-reports/:id/wrap-up                          → update wrap-up
PATCH  /api/daily-work-reports/:reportId/entries/:entryId/review    → PM review
GET    /api/projects/:projectId/daily-work-reports                  → this project's reports across everyone
```

### Blockers (INDEPENDENT)
```
POST   /api/blockers                        → report a blocker (active member of the project only)
PATCH  /api/blockers/:blockerId             → update/resolve
GET    /api/blockers                        → list (staff-scoped for DEVELOPER/DESIGNER, company-wide for PM/Admin)
GET    /api/projects/:projectId/blockers    → this project's blockers (PM dashboard)
```

---

## 🗂️ Related Files

- **Schema**: `prisma/schema.prisma` — `DailyWorkReport`, `DailyProjectEntry`, `Blocker`, plus their enums
- **Spec**: `pixelvega-build-spec.md` (repo root, gitignored)
- **Services**: `src/modules/projects/{daily-work-report,daily-project-entry,blocker}.service.ts`
- **Slack**: `docs/features/slack-integration/` — a separate feature, built afterward

---

## 📌 Document Status

| Document | Status |
|----------|--------|
| DESIGN.md | Describes the shipped implementation |
| IMPLEMENTATION_CHECKLIST.md | Complete, except unit tests (none exist yet, backend-wide) |
| ARCHITECTURE_NOTES.md | Describes the patterns actually used |

Not built, and not currently planned: reminder notifications for a missing daily submission, and the "Phase 3" combined-dashboard/analytics/SLA ideas from the original roadmap.
