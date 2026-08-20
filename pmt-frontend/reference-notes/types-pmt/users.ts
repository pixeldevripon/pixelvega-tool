/**
 * A user, as the API actually returns one.
 *
 * Mirrors `UserResponseDto` in `pmt-backend/src/users/dto/user.dto.ts`.
 *
 * **This is not `AppUser` in `types/auth.ts`, and the difference is a live
 * defect.** Phase 6 made every enum in a response `{ value, label, tone }`
 * (ADR 0001), so `role` and `status` are objects now. `AppUser` still types
 * both as bare strings, which is why the screens that still use it index
 * `roleLabels[user.role]` with an object and render an empty badge. Those
 * screens are rewritten one at a time in phase 8, each moving to this type; the
 * old one is left in place until then rather than editing twenty views at once.
 *
 * When the last screen has moved, delete `AppUser`, `roleLabels` and
 * `lib/auth-meta.ts`: the label the API sends replaces all three.
 */

import type { EnumDisplay } from "@/types/permissions";

export type User = {
  id: string;
  email: string;
  name: string;
  role: EnumDisplay;
  status: EnumDisplay;
  slackUserId: string | null;
  /** True until an invited user has replaced the password they were sent. */
  mustResetPassword: boolean;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
};

/** The shape of every paginated list the API serves. */
export type Paginated<T> = {
  items: T[];
  /** Across every page matching the filters, not the length of `items`. */
  total: number;
  page: number;
  pageSize: number;
};
