# Time Tracking Business Rules

Written in the same one sentence per rule, assertive style as `pixelvega-build-spec.md`, scoped to just time tracking so it is easy to read in one pass and easy to compare against later. `[IMPLEMENTED]` rules already exist in the codebase today. `[PROPOSED]` rules are the meeting time and same day lock addition drafted in `DESIGN.md` in this same folder, not yet built. Nothing in this file overrides `DESIGN.md`, this is the plain language summary of it plus the existing rules it builds on top of.

---

## Project Time Tracking [IMPLEMENTED]

A Developer or Designer starts, pauses, resumes, and stops a timer to record work on a project.

An Admin or System Admin can do the same on any project. A Project Manager cannot track project time at all, overseeing projects is the job, not billable work.

Each pause or resume closes the current segment and opens a brand new row under the same session id, rather than changing one row back and forth.

Only one timer can be running for a person at a time, counted across every project together, not one allowance per project.

Starting or resuming a timer while a different one is already running is rejected.

A single continuous running stretch is capped at 9 hours. If it is never touched again, the next thing that reads or writes it stops it right at the cap and drops whatever time ran past that.

Pausing or stopping a segment recalculates the project's actual hours immediately, a paused segment's elapsed time already counts even if the whole session is not finished yet.

Estimated hours are set by hand by a Project Manager, Admin, or System Admin. Remaining hours are never stored, they are worked out on every read as estimated hours minus actual hours.

A Client never sees any of this. Hours are left out entirely of the reduced project view a Client is given.

## Meeting Time Tracking [PROPOSED, not yet built, see `DESIGN.md`]

Admin, Project Manager, Developer, and Designer can start, pause, resume, and stop a timer for office meeting time, the same start, pause, resume, stop flow project time already uses.

A meeting timer belongs to the person tracking it only. It is never attached to a project.

Starting a meeting timer while a project timer is running is rejected. Starting a project timer while a meeting timer is running is rejected too. Only one timer of either kind can run for a person at once.

A meeting segment is capped at the same 9 hour limit as project time, and finalized the same lazy way, checked the next time anything touches it rather than by a background job.

Meeting time never changes a project's actual hours or any project report. It is counted as its own number, shown next to project hours, not folded into them.

A day's time view shows three numbers together for one person, hours tracked on projects that day, hours spent in meetings that day, and the two added together as the day's total.

## Same Day Completion and Lock [PROPOSED, not yet built, see `DESIGN.md` section 4.9]

A time entry, project or meeting, must be started and finished on the same UTC calendar day.

Someone who forgets to start a timer can still start it later that same day. There is no requirement to start right at the beginning of the day.

Once the day changes, a timer left running or paused from the day before can no longer be resumed, paused, or stopped by hand.

A timer left running past midnight UTC is finalized automatically the next time anything touches it, capped at exactly that day's end, never carrying extra time over into the new day.

There is no way to create an entry dated to a day before today. Every timer always starts at the moment it is created, never earlier.

## What This Does Not Change

No PM approval or review step is added for either kind of timer, same trust level as today.

No Slack message is posted for a meeting entry, and none of the existing project time Slack behavior changes.

No AI or automatic scope check is involved anywhere in time tracking, a timer is trusted input from the person running it.

Nobody is blocked from working just because they have not logged time yet that day. The same day lock only closes and freezes whatever was already started, it never stops someone from starting something new.
