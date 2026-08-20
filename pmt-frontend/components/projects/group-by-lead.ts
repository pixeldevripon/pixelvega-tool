import type { Project } from '@/types/projects';

/**
 * Group projects by their lead, preserving the order the server sent them in.
 *
 * ── Why this is grouping and not sorting ──
 *
 * The rows arrive already sorted by whatever the query asked for. Grouping walks
 * them ONCE and keeps first-seen order, so within a group the server's sort still
 * holds and the groups themselves appear in the order their first project did.
 * Re-sorting either would throw away the ordering the API applied before paging.
 *
 * ── Why a `Map` ──
 *
 * Insertion order is guaranteed, which is the whole point. A plain object with
 * id keys would also preserve it in practice, but only because these ids are not
 * integer-like, which is not a property to rely on.
 *
 * "No lead" comes LAST, always. A project with nobody staffed as manager cannot
 * leave Planning, so it is a thing to notice rather than the first thing you read.
 */

export type ProjectGroup = {
    /** The lead's user id, or `null` for the unled group. */
    key: string | null;
    label: string;
    avatarUrl: string | null;
    projects: Project[];
};

const NO_LEAD_LABEL = 'No lead';

export function groupByLead(projects: Project[]): ProjectGroup[] {
    const groups = new Map<string, ProjectGroup>();
    const unled: Project[] = [];

    for (const project of projects) {
        if (!project.lead) {
            unled.push(project);
            continue;
        }
        const existing = groups.get(project.lead.id);
        if (existing) {
            existing.projects.push(project);
            continue;
        }
        groups.set(project.lead.id, {
            key: project.lead.id,
            label: project.lead.name,
            avatarUrl: project.lead.avatarUrl,
            projects: [project],
        });
    }

    const result = [...groups.values()];
    if (unled.length > 0) {
        result.push({
            key: null,
            label: NO_LEAD_LABEL,
            avatarUrl: null,
            projects: unled,
        });
    }
    return result;
}
