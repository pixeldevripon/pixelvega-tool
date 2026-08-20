'use client';

import { useRole } from '@/contexts/role-context';
import { resolveDeepLink } from '@/lib/config/deep-links';

/**
 * The href for an API key, or null when this caller must not see a link.
 *
 * Thin on purpose: the rule lives in `resolveDeepLink`, which is a pure function
 * and has its own spec. This exists only to hand it the session's permission
 * set, so no component reaches for `canAny` and a role string at the same time.
 */
export function useDeepLink(key: string): string | null {
    const { canAny } = useRole();
    return resolveDeepLink(key, canAny);
}
