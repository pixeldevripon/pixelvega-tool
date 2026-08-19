// Shared between ProjectsService (workload lookups) and
// ProjectMembersService (assignment warnings) so both stay in sync. This is
// advisory, not enforced: a Developer/Designer can still be assigned beyond
// this many active projects, they just come back flagged as overloaded
// rather than being blocked.
export const RECOMMENDED_MAX_ACTIVE_PROJECTS = 3;
