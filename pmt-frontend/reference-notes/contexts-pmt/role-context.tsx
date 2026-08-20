"use client";

import { createContext, useContext, useMemo } from "react";
import { useMyPermissions } from "@/hooks/users/use-users";
import type { EnumDisplay, Permission } from "@/types/permissions";

/**
 * What this session may do, from the server.
 *
 * Fed by `GET /users/me/permissions`, which returns the effective set computed
 * from `ROLE_PERMISSIONS`: the same map `PermissionsGuard` consults. That
 * single source is the whole design (D2):
 *
 * - **Never gate on a role.** `role === "ADMIN"` in a component is a second
 *   copy of the permission map, written in a different language, in a codebase
 *   that cannot see when the first one changes. This app had 70 such
 *   comparisons producing 39 `canX` booleans, and every one of them was a
 *   chance to offer a button that then answered 403.
 * - **Frontend gating is UX, not security.** Hiding a control is a courtesy;
 *   the API refuses regardless. Nothing here is a boundary.
 *
 * `role` is exposed for DISPLAY only, as the `{ value, label, tone }` the
 * server sent. Rendering "Project Manager" next to someone's name is a label;
 * deciding what they may do is a permission.
 *
 * ## Per-project scope is a different question
 *
 * A permission answers "may this role ever do this". Whether this person may do
 * it to THIS project depends on their membership, and the API answers that per
 * resource with capability flags on the response (`canEdit`, `canArchive`).
 * Gate a screen from this context; gate a row from its own flags.
 */

export interface RoleContextValue {
  /** For display only. Never branch on it. */
  role: EnumDisplay | null;
  /** True once the set has arrived. Until then `can` answers false. */
  isLoaded: boolean;
  isLoading: boolean;
  /** The set could not be fetched. Treat as no permissions, and say so in the UI. */
  isError: boolean;

  /** Does the caller hold this capability? */
  can: (permission: Permission) => boolean;
  /** All of them. For a screen needing two capabilities at once. */
  canAll: (...permissions: Permission[]) => boolean;
  /** Any of them. Mirrors the API's `@RequireAnyPermission`. */
  canAny: (...permissions: Permission[]) => boolean;
}

/**
 * The default denies everything.
 *
 * Chosen so that a component rendered outside the provider, or before the set
 * arrives, shows the smaller UI rather than briefly offering actions that then
 * disappear. Failing closed also means forgetting the provider is a visible
 * bug rather than an invisible permission bypass.
 */
const DENY_ALL: RoleContextValue = {
  role: null,
  isLoaded: false,
  isLoading: false,
  isError: false,
  can: () => false,
  canAll: () => false,
  canAny: () => false,
};

const RoleContext = createContext<RoleContextValue>(DENY_ALL);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isError } = useMyPermissions();

  const value = useMemo<RoleContextValue>(() => {
    /**
     * A `Set<string>`, not `Set<Permission>`, on purpose.
     *
     * The API is the authority on what capabilities exist. If it grows one
     * before `types/permissions.ts` catches up, the string still lands here and
     * still matches, so the client cannot start refusing something the server
     * granted. The union is for autocomplete and typo safety, not a filter.
     */
    const granted = new Set<string>(data?.permissions ?? []);
    const isLoaded = Boolean(data);

    return {
      role: data?.role ?? null,
      isLoaded,
      isLoading,
      isError,
      can: (permission) => granted.has(permission),
      canAll: (...permissions) =>
        permissions.length > 0 && permissions.every((p) => granted.has(p)),
      canAny: (...permissions) => permissions.some((p) => granted.has(p)),
    };
  }, [data, isError, isLoading]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

/**
 * Read the caller's capabilities.
 *
 * Returns a deny-all value outside a provider rather than throwing. A thrown
 * error would take down a screen over what is a presentation concern, and
 * denying is the safe direction.
 */
export function usePermissions(): RoleContextValue {
  return useContext(RoleContext);
}
