import { Permission, type PermissionKey } from '@/lib/config/rbac';

/**
 * Where a number on the overview takes you, and whether it may.
 *
 * ── Why a registry and not an href on each card ──
 *
 * Every figure on the overview is a summary of a screen, so every figure should
 * be a door to that screen. Three things have to hold before one can be
 * rendered as a link, and they were being answered in three different places:
 *
 *   1. **Which screen** holds the detail behind this figure.
 *   2. **Whether the caller may reach it.** A link to a queue that answers 403
 *    is a worse experience than no link: the reader clicks, waits, and is told
 *    off. The gate is a PERMISSION, never a role (D2), and it is the same
 *    permission `navigations.ts` gates the sidebar entry on, so a destination
 *    cannot be reachable from one surface and hidden on the other.
 *   3. **Whether the screen EXISTS yet.** This app is mid-build. Five of the
 *    destinations the overview summarises have no route: `/time`, `/my-day`,
 *    `/requirements`, `/reviews` and `/client-feedback` are all in the plan and
 *    none of them is written. `attention-card.tsx` linked to three of them
 *    anyway, so three rows of the "Needs attention" card were 404s.
 *
 * `built: false` is the honest answer to the third. The item still renders and
 * still shows its number; it is simply not a link. When the screen lands, one
 * flag flips here and every surface that reads this registry becomes a door at
 * once.
 *
 * ── What this is NOT ──
 *
 * Not a security boundary. Hiding a link is a courtesy; the API refuses
 * regardless. And not a place to invent wording: the label a reader sees always
 * comes from the response.
 */
export type DeepLink = {
    href: string;
    /**
     * ANY-of, matching `filterNavGroups`. An empty array means every caller who
     * reaches the overview may follow it.
     */
    permissions: PermissionKey[];
    /**
     * False while the destination route does not exist. Flip it in the same PR
     * that adds the screen, never before: a link is a promise.
     */
    built: boolean;
};

/**
 * Keyed on the API's own stable identifiers.
 *
 * A metric's `key` and an attention item's `key` are documented as stable and
 * are never rendered, exactly so a client can hang an icon or a link off them.
 * A key this build has not seen simply has no entry and renders as plain text,
 * because a client must never break on an API that moved forward.
 */
export const DEEP_LINKS: Record<string, DeepLink> = {
    // ── Headline tiles ──
    activeProjects: {
        // The two statuses the tile counts, which is the phase that covers
        // them. `?phase=` is a real filter on the projects list, so the page
        // that opens holds the same projects the tile counted.
        href: '/projects?phase=IN_PROGRESS',
        permissions: [],
        built: true,
    },
    hoursLogged: {
        href: '/time',
        permissions: [Permission.VIEW_TIME_ENTRIES],
        built: false,
    },
    openBlockers: {
        href: '/blockers',
        permissions: [Permission.VIEW_BLOCKERS],
        built: true,
    },
    atRisk: {
        href: '/projects?overdue=true',
        permissions: [],
        built: true,
    },

    // ── "Needs attention" queues ──
    overdueProjects: {
        href: '/projects?overdue=true',
        permissions: [],
        built: true,
    },
    pendingRequirements: {
        href: '/requirements',
        permissions: [Permission.VIEW_ADDITIONAL_REQUIREMENTS],
        built: false,
    },
    pendingLeaveRequests: {
        href: '/leave',
        permissions: [Permission.VIEW_LEAVE_REQUESTS],
        built: true,
    },
    notReadyToStart: {
        href: '/projects?phase=TO_DO',
        permissions: [],
        built: true,
    },
    internalReview: {
        href: '/projects?phase=IN_REVIEW',
        // Was `/reviews`, which does not exist. The phase filter answers the
        // same question ("what is sitting in review") with a route that is
        // written, and needs no permission a reader of this card lacks.
        permissions: [],
        built: true,
    },
    awaitingClientFeedback: {
        href: '/projects?status=WAITING_FOR_FEEDBACK',
        permissions: [],
        built: true,
    },

    // ── Cards ──
    standupCompliance: {
        href: '/standups',
        permissions: [Permission.VIEW_WORK_REPORTS],
        built: true,
    },
    myDay: {
        href: '/my-day',
        permissions: [
            Permission.TRACK_PROJECT_TIME,
            Permission.SUBMIT_WORK_REPORT,
        ],
        built: false,
    },
    topContributors: {
        href: '/users',
        permissions: [Permission.VIEW_USERS],
        built: true,
    },
};

/**
 * The href for a key, or null when it must not be a link.
 *
 * Null for all three reasons in one place: no entry, the route is not built, or
 * the caller holds none of its permissions. A caller reads this through
 * `useDeepLink`, which supplies the permission set from context.
 */
export function resolveDeepLink(
    key: string,
    holds: (permissions: PermissionKey[]) => boolean,
): string | null {
    const link = DEEP_LINKS[key];
    if (!link || !link.built) return null;
    if (link.permissions.length === 0) return link.href;
    return holds(link.permissions) ? link.href : null;
}
