# Notification Business Rules

Written in the same one sentence per rule, assertive style as `pixelvega-build-spec.md` and `TIME_TRACKING_BUSINESS_RULES.md`, so it is easy to read in one pass and easy to compare against later. Everything below is `[PROPOSED]`, nothing is built yet. There is no `Notification` model in `schema.prisma` today and no `NotificationsModule` anywhere in `src/`. The only notification style behavior that exists right now is the Slack channel posts described in `docs/features/slack-integration/DESIGN.md`, which are channel wide and never aimed at one person.

This covers every module that exists in the app today, not only Projects, and closes with a framework for deciding notifications on any module built after this draft, so the rules do not need to be rewritten from scratch each time.

---

## What A Notification Is, In This Draft

A notification is a new, per user, in app record. It is not a replacement for the existing Slack channel posts, those keep working exactly as they do today, unchanged.

A notification always names one actor, one action, and one target, project, blocker, leave request, or whatever the entity is, so the same shape covers every event without a special case per feature.

Sending a notification never blocks or fails the action that caused it, the same fire and forget pattern already used for every Slack call in this codebase.

A notification is always addressed to a specific user id. There is no channel wide or broadcast row, a broadcast is expressed as one row per recipient.

## Core Principles, Applied To Every Module Below

Recipients for any event are chosen the same way the codebase already chooses who can read that data, not invented separately per feature. If a role already has unrestricted read access to something, ADMIN and SYSTEM_ADMIN today, that role is already a safe default recipient.

The actor of an event is never notified about their own action, they already know they just did it.

Any event the codebase already writes to the audit log against a specific target user personally notifies that target user, since the audit log itself is only ever visible to ADMIN and SYSTEM_ADMIN, the person it happened to has no other way to find out today.

Wherever a Slack channel already exists for a project, an in app notification for that project mirrors that channel's roster exactly, active members of that project plus ADMIN and SYSTEM_ADMIN, so this feature never invents a second, different definition of who is "on" a project.

Wherever the underlying data has no per role scoping yet, leave requests are not scoped to one PROJECT_MANAGER's own reports for example, the notification is company wide too, matching that same limitation, not narrower than the data already is.

A status change into a small set of especially consequential values, `ON_HOLD`, `CANCELLED`, or `WAITING_FOR_FEEDBACK` for a Project, `RESOLVED` for a Blocker, `REJECTED` for a LeaveRequest, `CHANGES_REQUIRED` for an Internal Review, notifies more broadly than a routine forward step does. Routine, expected progress only reaches the people directly working on it, not every ADMIN company wide, so the feature does not turn into noise.

A CLIENT is only ever a recipient for events already visible to a CLIENT elsewhere in the app, project status and their own client feedback, never for anything internal only, blockers, additional requirements, internal review, staffing.

## Round One, Building Now

### Project Created

Every ADMIN and every SYSTEM_ADMIN gets notified when any project is created, since they already have unscoped read access to every project and are already invited to its Slack channel the moment it exists.

The project's assigned Client gets notified that a new project now exists for them, since `clientId` is required on every project and CLIENT is the one role whose whole view of the app is scoped to their own projects.

The person who created the project never gets notified about their own action.

When a PROJECT_MANAGER creates a project, no DEVELOPER or DESIGNER gets notified at creation time, nobody is staffed on the project yet, staffing only happens afterward as a separate step, see Staffing below.

When an ADMIN or SYSTEM_ADMIN creates a project instead of a PROJECT_MANAGER, no PROJECT_MANAGER is auto staffed either, so the recipients are only the Client and every other ADMIN and SYSTEM_ADMIN.

### Blockers

The recipient list for a blocker notification is exactly the roster of the project's Slack channel, every active `ProjectMember` of that specific project plus every ADMIN and SYSTEM_ADMIN, minus whoever caused the event.

When a blocker is reported, every one of those recipients gets notified, naming the reporter, the severity, and the project.

When a blocker's status changes, the same recipient list gets notified again, naming who made the change and what the new status is. This only fires when `status` itself changes, an edit to only `description` or `severity` sends nothing.

When a blocker is assigned or reassigned to someone, that person gets one additional, personal notification calling out the assignment directly, on top of the broadcast the rest of the team receives. Nobody gets this today, the existing Slack post only names the assignee in plain text, it never pings them.

The blocker's original reporter always gets notified of every status change on their own blocker, even after they leave the project and stop being an active member, since it is their history to follow and the Slack channel roster is scoped to current membership only.

When a blocker is resolved, the notification to every recipient includes the resolution notes, since that is the one field required specifically at resolution and it is the actionable content of the message.

No CLIENT ever receives a blocker notification.

## Already Decided, Not Yet Building

The following apply the same Core Principles to every other module in the app today. They are business decisions ready to reuse whenever notifications expand past round one, not a commitment to build them next.

### Users

A user being invited does not get an in app notification, the account cannot use the app until the invite is accepted, the existing invite email already covers this event and stays the only channel for it.

A password being changed or reset (`user.password_changed`, `user.password_reset`) always personally notifies the account owner, regardless of whether they or an ADMIN triggered it, security relevant events always reach the person they happened to.

A role or status change via `PATCH /users/:id` (`user.updated`) personally notifies the target user of what changed, field, previous value, new value, mirroring the same `changes` shape `UsersService.update()` already writes to the audit log.

Inviting a new ADMIN, or changing an existing user's role to ADMIN, additionally notifies every other ADMIN and SYSTEM_ADMIN, the most sensitive role change the system allows short of SYSTEM_ADMIN, which no API path can create at all.

A user being deleted (soft delete) does not notify the now deleted account, it notifies every ADMIN and SYSTEM_ADMIN instead, an audit trail for a decision the target can no longer act on.

### Profiles

No profile event is proposed. `PATCH /profiles/me` and the avatar upload are always self triggered, and the actor is never notified about their own action.

### Leave Management

A leave request being created notifies every ADMIN, SYSTEM_ADMIN, and PROJECT_MANAGER company wide, the same company wide reach `LeaveRequestsService.findAll()` already gives PROJECT_MANAGER today. If that read scoping ever narrows to a PM's own reports, this notification narrows the same way, not before.

A leave request being approved or rejected personally notifies the requester of the outcome.

A leave request being cancelled by its requester notifies whoever would have approved it, ADMIN, SYSTEM_ADMIN, and PROJECT_MANAGER company wide, so nobody acts on a request that no longer exists.

A new Holiday being added notifies every active employee company wide, it changes a shared calendar everyone plans around, not just the ADMIN who added it.

### Projects, Status And Priority

A project status change into `ON_HOLD`, `CANCELLED`, or `WAITING_FOR_FEEDBACK` notifies every active member of that project plus ADMIN and SYSTEM_ADMIN.

Every other status move only notifies active members of that project, not ADMIN and SYSTEM_ADMIN company wide, routine forward progress is not worth their attention.

A priority change to `URGENT` or `CRITICAL`, which requires a `rushReason`, notifies every active member of that project plus ADMIN and SYSTEM_ADMIN, a rush reason is loud on purpose.

Priority moving off `URGENT` or `CRITICAL` does not notify anyone, quietly returning to normal is not news.

A project being archived notifies every active member of that project, so nobody keeps tracking time or reporting work against a project that just disappeared from their active lists.

### Staffing

A person being added as a `ProjectMember` is personally notified, this is what tells a DEVELOPER or DESIGNER they now have a new project at all.

A person being removed (`leftAt` set) is personally notified, so they know to stop tracking time or reporting work on it.

### Project Documents

No document event is proposed. Volume is high, `POST .../documents/batch` allows up to ten files at once, and the roles who need to see documents already have unrestricted or membership scoped read access; revisit only if this becomes a real, stated complaint.

### Time Tracking

No time tracking event is proposed. Every timer belongs to the one person running it, including the 9 hour auto stop, and the actor is never notified about their own action.

### Additional Requirements

A new requirement being logged notifies every PROJECT_MANAGER staffed on that specific project plus ADMIN and SYSTEM_ADMIN, the same reach `assertManagesProject()` already gives the review action, this is a decision waiting on them.

A requirement being approved or rejected personally notifies whoever logged it.

### Daily Work Reports

No submission event is proposed. A plan or wrap up being submitted is routine, self triggered work, and the actor is never notified about their own action.

A daily report entry being reviewed personally notifies the DEVELOPER or DESIGNER whose entry it is, feedback on your own work is the one thing in this module worth a personal notification.

### Internal Review

A review decision, `APPROVED` or `CHANGES_REQUIRED`, personally notifies the DEVELOPER or DESIGNER whose work was reviewed, they cannot learn this any other way today short of checking the project's status by hand.

`CHANGES_REQUIRED` additionally notifies every active member of that project plus ADMIN and SYSTEM_ADMIN, the project is moving back to `READY_FOR_WORK`, the same consequential status change rule used elsewhere in this draft.

`APPROVED` does not notify beyond the reviewed developer or designer, moving to `READY_FOR_CLIENT` is good news for the one person who needed to hear it, not urgent news for the whole team.

### Client Feedback

A feedback round personally notifies every PROJECT_MANAGER staffed on that project plus ADMIN and SYSTEM_ADMIN.

`CHANGES_REQUESTED` on the first round additionally notifies every active DEVELOPER and DESIGNER member of that project, `Project.status` is about to move back to `READY_FOR_WORK` and they are the ones about to pick the work back up.

`APPROVED` on the first round does not need to reach DEVELOPER or DESIGNER individually beyond the project's own status changing to `COMPLETED`, which the consequential status change rule already covers.

The CLIENT who submitted feedback is never notified about their own submission. A PROJECT_MANAGER recording feedback on the Client's behalf does not notify the Client either, the Client already knows what they said.

### Audit Log

The audit log module is never itself a source of notifications, it is where every notification worthy event is already, or could be, recorded. A notification is a personal, user facing echo of a subset of what the audit log already logs company wide for ADMIN, not a second thing to instrument.

### Slack Integration

Not a source of new notification events, it is the existing broadcast channel this whole feature sits next to, per the Core Principles above.

## Framework For Modules Built After This Draft

Every new module answers the same four questions before its notifications ship, the same way Projects and Blockers were decided above.

What is the trigger. Name the exact write action, a specific service method or a specific status value being set, not "something changed."

What is the target entity. Name the one thing the notification links back to, so the reader can jump straight to it.

Who are the recipients. Reuse the Core Principles above, mirror whatever read scoping already exists for this data today, do not invent a new definition of who is "allowed to know."

Is it broadcast, personal, or both. A broadcast reaches everyone already scoped in, a personal notification calls out one specific person the way blocker assignment and review decisions do above, some events need both at once.

## What This Does Not Change

No existing Slack message changes shape or stops firing, this feature sits next to Slack, not on top of it.

No action anywhere in the app is blocked, delayed, or rejected because a notification failed to send, matching the fire and forget guarantee every `SlackService` method already gives.

No email is sent for any event in this draft, this covers in app notifications only.

No read or unread state, delivery channel beyond in app, or retention rule is decided yet, see Open Questions below.

## Open Questions

Does a notification need a read and unread state from day one, or is a flat list of "everything that happened to me" enough for the first version.

Does the frontend poll `GET /notifications` on an interval, or does this need a real time push, a websocket or similar, from the start.

Is there a cap or expiry on how long a notification is kept, or does every row live forever like `ProjectActivity` already does.

Now that this spans every module, does a recipient need a per module or per event type on and off setting, or is one single, always on inbox enough for the first version.

Which module ships second, after Projects and Blockers. This draft orders nothing, it only records the decisions so whichever one is picked next does not need to relitigate who the recipients are.

