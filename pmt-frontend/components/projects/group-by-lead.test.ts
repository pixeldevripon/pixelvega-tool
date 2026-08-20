import { describe, expect, it } from 'vitest';

import { groupByLead } from '@/components/projects/group-by-lead';
import type { Project, ProjectMemberSummary } from '@/types/projects';

/**
 * Grouping must not become sorting. The API applies its sort BEFORE paging, so
 * re-ordering rows here would present page one as though it were the first rows
 * by some other measure.
 */

const lead = (id: string, name: string): ProjectMemberSummary => ({
    id,
    name,
    avatarUrl: null,
    projectRole: { value: 'PROJECT_MANAGER', label: 'Project manager', tone: 'default' },
});

const project = (name: string, its: ProjectMemberSummary | null): Project =>
    ({ id: name, name, lead: its }) as unknown as Project;

describe('groupByLead', () => {
    it('keeps the order the groups first appeared in', () => {
        const ada = lead('ada', 'Ada');
        const bea = lead('bea', 'Bea');

        const groups = groupByLead([
            project('p1', bea),
            project('p2', ada),
            project('p3', bea),
        ]);

        // Bea first because her project came first, NOT alphabetically.
        expect(groups.map((g) => g.label)).toEqual(['Bea', 'Ada']);
    });

    it('keeps the server order within a group', () => {
        const ada = lead('ada', 'Ada');
        const groups = groupByLead([
            project('second', ada),
            project('first', ada),
        ]);

        expect(groups[0].projects.map((p) => p.name)).toEqual([
            'second',
            'first',
        ]);
    });

    it('puts "No lead" last, however early it appeared', () => {
        // A project with nobody staffed as manager cannot leave Planning, so it
        // is worth noticing rather than the first thing read.
        const groups = groupByLead([
            project('unled', null),
            project('led', lead('ada', 'Ada')),
        ]);

        expect(groups.map((g) => g.label)).toEqual(['Ada', 'No lead']);
    });

    it('omits the unled group entirely when every project has a lead', () => {
        const groups = groupByLead([project('led', lead('ada', 'Ada'))]);
        expect(groups.map((g) => g.label)).toEqual(['Ada']);
    });

    it('returns nothing for no projects', () => {
        expect(groupByLead([])).toEqual([]);
    });

    it('collects every unled project into one group', () => {
        const groups = groupByLead([
            project('a', null),
            project('b', lead('ada', 'Ada')),
            project('c', null),
        ]);

        expect(groups).toHaveLength(2);
        expect(groups[1].projects.map((p) => p.name)).toEqual(['a', 'c']);
    });
});
