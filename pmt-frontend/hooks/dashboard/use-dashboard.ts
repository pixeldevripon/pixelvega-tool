'use client';

import { useQuery } from '@tanstack/react-query';

import { dashboardApi } from '@/lib/api/dashboard';

/**
 * The key factory. Every query and every invalidation goes through it: an inline
 * key array drifts and silently stops matching, so a mutation elsewhere would
 * stop refreshing this screen with nothing to show why.
 */
export const dashboardKeys = {
  all: ['dashboard'] as const,
  detail: (days: number | undefined) =>
    [...dashboardKeys.all, { days: days ?? null }] as const,
};

export function useDashboard(days?: number) {
  return useQuery({
    queryKey: dashboardKeys.detail(days),
    queryFn: () => dashboardApi.get({ days }),
    // The figures are a snapshot of right now, and someone leaving this tab open
    // all morning should not be reading yesterday's numbers. Short enough to
    // stay honest, long enough that flicking between screens does not refetch.
    staleTime: 60_000,
  });
}
