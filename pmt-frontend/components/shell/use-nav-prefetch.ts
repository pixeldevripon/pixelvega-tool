'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * Warms a list page's TanStack query when its sidebar link is hovered or
 * focused, so the rows are already in cache by the time the click lands.
 *
 * Why this and not a route prefetch: the route side is already instant (these
 * pages are synchronous server shells that fetch nothing), so what a user now
 * waits on is the table's own `useQuery` firing on mount. `<Link>` prefetching
 * cannot help with that - it warms the RSC payload, not the client cache.
 *
 * THE PARAMS BELOW MUST MIRROR `useTableState`'s DEFAULTS EXACTLY. Query keys
 * include the params object, so a prefetch under `{page: 1, limit: 20}` is
 * dead weight if the list view mounts with anything else. `useTableState`
 * defaults to page 1 / limit 20 and drops both from the URL at those values
 * (`use-table-state.ts:37,42-43`), which is the state a sidebar click produces.
 * A user arriving on a deep-linked URL with filters gets a normal fetch - the
 * prefetch is an optimization for the common path, never a correctness input.
 *
 * ── Currently a no-op, deliberately ──
 *
 * The reference wired three of its own routes here (bookings, cancellation
 * requests, payments). Those went with its domain. The hook itself stays
 * because `nav-main.tsx` calls it on every link hover, and because the rule
 * for adding a route back is worth keeping written down:
 *
 * **Confirm the list view's mount-time params before adding a case.** A
 * prefetch whose key misses just burns a request, silently. Only add a route
 * whose key can be matched exactly.
 */
const DEFAULT_LIST = { page: 1, limit: 20 } as const;

export function useNavPrefetch() {
    const queryClient = useQueryClient();

    return useCallback(
        (url?: string) => {
            switch (url) {
                // Add a case per list route as each module lands, using
                // DEFAULT_LIST unless that screen pins extra params on mount.
                default:
                    break;
            }
            // Referenced so the constant above documents the contract rather
            // than reading as dead code while the switch is empty.
            void DEFAULT_LIST;
            void queryClient;
        },
        [queryClient],
    );
}
