// A hard ceiling on any single continuous (uninterrupted RUNNING) TimeEntry
// segment. Unlike RECOMMENDED_MAX_ACTIVE_PROJECTS this is enforced, not
// advisory. Modeled as 9 office hours. A user can still work more than 9
// hours in a day, just not in one unbroken stretch, since pausing resets
// the clock for the next segment. This is primarily a safety net against a
// forgotten running timer: checked lazily whenever a RUNNING entry is next
// touched (its own pause/stop, or the user's next start/resume attempt
// elsewhere), not via a background job.
export const MAX_CONTINUOUS_SESSION_MINUTES = 9 * 60;
