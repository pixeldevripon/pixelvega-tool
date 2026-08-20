import type { DashboardResponse } from '@/types/dashboard';

import { apiFetch } from './fetch';
import { buildQuery } from './query';

/**
 * The landing screen, in one request.
 *
 * One endpoint rather than one per role: working out which dashboard you are
 * entitled to is derivation, and doing it here would be a second copy of the
 * rule that decides it. The response carries an `audience` discriminator and
 * exactly one populated block.
 */
export const dashboardApi = {
  get(params: { days?: number } = {}): Promise<DashboardResponse> {
    return apiFetch<DashboardResponse>(
      `/dashboard${buildQuery({ days: params.days })}`,
    );
  },
};
