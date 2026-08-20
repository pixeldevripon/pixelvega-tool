/**
 * What is pinned here is the PER-ROLE INFORMATION ARCHITECTURE, because it is
 * produced by permission filtering rather than written down anywhere as a list.
 * A permission added to the wrong `ROLE_PERMISSIONS` group, or a nav row gated
 * on a permission from the `EVERYONE` set, silently puts a screen in a
 * sidebar it does not belong in. Neither `lint` nor `typecheck` can see that.
 *
 * The CLIENT cases matter most: a client seeing an internal queue is a
 * disclosure, not a cosmetic bug.
 */
import { describe, expect, it } from 'vitest';

import { Permission, ROLE_PERMISSIONS, type RoleKey } from '@/lib/config/rbac';
import { filterNavGroups } from '@/lib/rbac-utils';
import { getNavigations } from './navigations';

const nav = () => getNavigations().dashboard;

/** The rows a role actually sees, as `Group > Title` strings. */
function rowsFor(role: RoleKey): string[] {
    return filterNavGroups(nav(), ROLE_PERMISSIONS[role]).flatMap((group) =>
        group.items.map((item) => `${group.label} > ${item.title}`),
    );
}

function groupsFor(role: RoleKey): string[] {
    return filterNavGroups(nav(), ROLE_PERMISSIONS[role]).map(
        (group) => group.label ?? '',
    );
}

describe('navigation shape', () => {
    it('gives every row at least one permission, so nothing is ungated', () => {
        const ungated = nav()
            .flatMap((g) => g.items)
            .filter((i) => !i.permissions || i.permissions.length === 0);
        expect(ungated.map((i) => i.title)).toEqual([]);
    });

    it('only references permissions that exist in the API contract', () => {
        const known = new Set<string>(Object.values(Permission));
        const unknown = nav()
            .flatMap((g) => g.items)
            .flatMap((i) => i.permissions ?? [])
            .filter((p) => !known.has(p));
        expect(unknown).toEqual([]);
    });

    it('has no duplicate route across groups', () => {
        const urls = nav()
            .flatMap((g) => g.items)
            .map((i) => i.url);
        expect(urls.length).toBe(new Set(urls).size);
    });
});

describe('CLIENT', () => {
    it('sees only Work, and within it only Overview and Projects', () => {
        expect(groupsFor('CLIENT')).toEqual(['Work']);
        expect(rowsFor('CLIENT')).toEqual([
            'Work > Overview',
            'Work > Projects',
        ]);
    });

    it.each([
        'Standups',
        'Blockers',
        'Time',
        'Requirements',
        'Internal reviews',
        'Client feedback',
        'Reports',
        'AI',
        'Team',
        'Leave',
        'Holidays',
        'Blocker reasons',
        'Leave types',
        'AI templates',
        'Audit log',
    ])('never sees %s', (title) => {
        expect(rowsFor('CLIENT').some((r) => r.endsWith(`> ${title}`))).toBe(
            false,
        );
    });
});

describe('DEVELOPER and DESIGNER', () => {
    it.each(['DEVELOPER', 'DESIGNER'] as const)(
        '%s sees My day, because it holds TRACK_PROJECT_TIME',
        (role) => {
            expect(rowsFor(role)).toContain('Work > My day');
        },
    );

    it.each(['DEVELOPER', 'DESIGNER'] as const)(
        '%s reaches no cross-project queue: those are PM and above',
        (role) => {
            expect(groupsFor(role)).not.toContain('Deliver');
        },
    );

    it('sees no admin configuration and no audit log', () => {
        const rows = rowsFor('DEVELOPER');
        expect(rows).not.toContain('Configure > Blocker reasons');
        expect(rows).not.toContain('Configure > Leave types');
        expect(rows).not.toContain('Configure > Audit log');
        // But AI templates are readable by every internal role.
        expect(rows).toContain('Configure > AI templates');
    });

    it('reaches Leave and Holidays, because it holds REQUEST_LEAVE', () => {
        const rows = rowsFor('DEVELOPER');
        expect(rows).toContain('People > Leave');
        expect(rows).toContain('People > Holidays');
    });
});

describe('PROJECT_MANAGER', () => {
    it('reaches every Deliver queue', () => {
        const rows = rowsFor('PROJECT_MANAGER');
        expect(rows).toContain('Deliver > Requirements');
        expect(rows).toContain('Deliver > Internal reviews');
        expect(rows).toContain('Deliver > Client feedback');
    });

    it('does NOT see My day: a PM holds neither tracking permission', () => {
        expect(rowsFor('PROJECT_MANAGER')).not.toContain('Work > My day');
    });

    it('configures blocker reasons, and nothing else admin-only', () => {
        const rows = rowsFor('PROJECT_MANAGER');
        // features.md: "A PM or an Admin controls what reasons appear on that
        // list." So this row is correct for a PM and is why Configure is one
        // row per permission rather than a single Settings row.
        expect(rows).toContain('Configure > Blocker reasons');
        expect(rows).toContain('Configure > AI templates');
        expect(rows).not.toContain('Configure > Leave types');
        expect(rows).not.toContain('Configure > Audit log');
    });

    it('reaches Leave, which it may read but not approve', () => {
        // The read/approve split is enforced per control inside the screen,
        // from REVIEW_LEAVE_REQUEST, which a PM does not hold.
        expect(rowsFor('PROJECT_MANAGER')).toContain('People > Leave');
        expect(
            ROLE_PERMISSIONS.PROJECT_MANAGER.includes(
                Permission.REVIEW_LEAVE_REQUEST,
            ),
        ).toBe(false);
    });
});

describe('ADMIN and SYSTEM_ADMIN', () => {
    it.each(['ADMIN', 'SYSTEM_ADMIN'] as const)(
        '%s sees every group',
        (role) => {
            expect(groupsFor(role)).toEqual([
                'Work',
                'Deliver',
                'Insight',
                'People',
                'Configure',
            ]);
        },
    );

    it('sees every row in the tree, since ADMIN is a strict superset', () => {
        const everyRow = nav().flatMap((g) =>
            g.items.map((i) => `${g.label} > ${i.title}`),
        );
        expect(rowsFor('ADMIN')).toEqual(everyRow);
    });

    it('SYSTEM_ADMIN sees exactly what ADMIN sees', () => {
        expect(rowsFor('SYSTEM_ADMIN')).toEqual(rowsFor('ADMIN'));
    });
});

describe('filterNavGroups', () => {
    it('drops a group once all of its items are filtered out', () => {
        const filtered = filterNavGroups(nav(), [Permission.VIEW_OWN_PROJECTS]);
        expect(filtered.map((g) => g.label)).toEqual(['Work']);
        expect(filtered[0].items.map((i) => i.title)).toEqual([
            'Overview',
            'Projects',
        ]);
    });

    it('returns nothing at all for an empty permission set', () => {
        expect(filterNavGroups(nav(), [])).toEqual([]);
    });
});
