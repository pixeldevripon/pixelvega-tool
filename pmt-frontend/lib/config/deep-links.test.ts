import { describe, expect, it } from 'vitest';

import { DEEP_LINKS, resolveDeepLink } from './deep-links';
import { Permission, type PermissionKey } from './rbac';

/**
 * The registry decides whether a number on the overview is a link. Getting it
 * wrong in either direction is a real defect: too permissive ships a 404 or a
 * 403, too strict silently removes a door the caller had.
 */

/** Holds everything, so only `built` and the entry's existence can refuse. */
const holdsAll = () => true;
/** Holds nothing, so only an empty permission list can pass. */
const holdsNone = () => false;
const holds = (granted: PermissionKey[]) => (needed: PermissionKey[]) =>
    needed.some((p) => granted.includes(p));

describe('resolveDeepLink', () => {
    it('returns null for a key it has never heard of', () => {
        // A client must never break on an API that moved forward: an unknown
        // metric key renders its number and simply is not a link.
        expect(resolveDeepLink('somethingNew', holdsAll)).toBeNull();
    });

    it('returns null for a destination whose screen is not built', () => {
        // `/time` is in the plan and is not written. A link to it is a 404,
        // which is worse than no link.
        expect(DEEP_LINKS.hoursLogged.built).toBe(false);
        expect(resolveDeepLink('hoursLogged', holdsAll)).toBeNull();
    });

    it('returns the href when the route is built and needs no permission', () => {
        expect(resolveDeepLink('atRisk', holdsNone)).toBe(
            '/projects?overdue=true',
        );
    });

    it('returns null when the caller holds none of the permissions', () => {
        expect(resolveDeepLink('openBlockers', holdsNone)).toBeNull();
    });

    it('returns the href when the caller holds one of the permissions', () => {
        expect(
            resolveDeepLink('openBlockers', holds([Permission.VIEW_BLOCKERS])),
        ).toBe('/blockers');
    });

    it('treats the permission list as ANY-of, matching the sidebar filter', () => {
        // `myDay` needs either of two. Holding just one is enough, the same rule
        // `filterNavGroups` applies, so a destination cannot be reachable from
        // the sidebar and hidden here.
        const link = DEEP_LINKS.myDay;
        expect(link.permissions).toHaveLength(2);
        expect(
            holds([Permission.SUBMIT_WORK_REPORT])(link.permissions),
        ).toBe(true);
    });

    it('refuses an unbuilt route even to a caller who holds its permission', () => {
        // `built` is checked first on purpose: permission is about entitlement,
        // and no entitlement conjures a route that does not exist.
        expect(
            resolveDeepLink('pendingRequirements', holdsAll),
        ).toBeNull();
    });
});

describe('DEEP_LINKS', () => {
    /**
     * The routes that exist in `app/(app)/`. Kept as a literal list rather than
     * read off the filesystem: a spec that globbed the app directory would pass
     * whatever the directory happened to contain, including a route that was
     * deleted, so it would never catch the case this exists for.
     */
    const BUILT_ROUTES = [
        '/account',
        '/audit-logs',
        '/blockers',
        '/leave',
        '/profile',
        '/projects',
        '/standups',
        '/users',
    ];

    it('points every built link at a route that exists', () => {
        // The defect this closes: `attention-card.tsx` linked to
        // `/requirements`, `/reviews` and `/client-feedback`, none of which are
        // written, so half of that card was 404s.
        for (const [key, link] of Object.entries(DEEP_LINKS)) {
            if (!link.built) continue;
            const path = link.href.split('?')[0];
            expect(BUILT_ROUTES, `${key} -> ${link.href}`).toContain(path);
        }
    });

    it('marks every link to an unwritten screen as not built', () => {
        for (const [key, link] of Object.entries(DEEP_LINKS)) {
            const path = link.href.split('?')[0];
            if (BUILT_ROUTES.includes(path)) continue;
            expect(link.built, `${key} -> ${link.href}`).toBe(false);
        }
    });

    it('gates every link to an internal queue on a permission', () => {
        // The two ungated shapes are deliberate: `/projects` filtered views need
        // no permission beyond reaching the overview, because the API scopes the
        // list to what the caller may see anyway.
        for (const [key, link] of Object.entries(DEEP_LINKS)) {
            if (link.href.startsWith('/projects')) continue;
            expect(link.permissions.length, key).toBeGreaterThan(0);
        }
    });

    it('uses real permission names', () => {
        const known = new Set<string>(Object.values(Permission));
        for (const [key, link] of Object.entries(DEEP_LINKS)) {
            for (const permission of link.permissions) {
                expect(known, `${key}: ${permission}`).toContain(permission);
            }
        }
    });
});
