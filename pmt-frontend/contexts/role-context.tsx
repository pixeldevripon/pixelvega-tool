'use client';

import { createContext, useContext } from 'react';

import {
    ROLE_PERMISSIONS,
    type PermissionKey,
    type RoleKey,
} from '@/lib/config/rbac';

/**
 * An enum as the API sends it (ADR 0001): a value to compare, a label to render,
 * and a tone to render it at.
 */
export interface EnumDisplay {
    value: string;
    label: string;
    tone: string;
}

interface RoleContextValue {
    /**
     * The caller's role, as the API sent it.
     *
     * **For DISPLAY.** Render `role.label` next to someone's name; that is a
     * label. Deciding what they may do is a permission, and the two must not be
     * confused. It is the whole object rather than a string precisely so that
     * `role` cannot be dropped into a comparison by accident: `role === 'ADMIN'`
     * does not typecheck, and `role.value === 'ADMIN'` reads like the deliberate
     * choice it should be.
     */
    role: EnumDisplay | undefined;
    /** The EFFECTIVE permission set gating this session's UI. */
    permissions: PermissionKey[];
    can: (permission: PermissionKey) => boolean;
    canAny: (permissions: PermissionKey[]) => boolean;
    canAll: (permissions: PermissionKey[]) => boolean;
}

/**
 * The default denies everything.
 *
 * Chosen so a component rendered outside the provider, or before the set
 * arrives, shows the SMALLER UI rather than briefly offering actions that then
 * disappear. Failing closed also makes a forgotten provider a visible bug
 * instead of an invisible permission bypass.
 */
const RoleContext = createContext<RoleContextValue>({
    role: undefined,
    permissions: [],
    can: () => false,
    canAny: () => false,
    canAll: () => false,
});

/**
 * Distributes the session's role and its EFFECTIVE permissions.
 *
 * `permissions` comes from `GET /users/me/permissions`, which is computed from
 * the same `ROLE_PERMISSIONS` map `PermissionsGuard` consults. **The server's
 * answer always wins when we have it.** The static mirror in
 * `lib/config/rbac.ts` is the fallback for the window before it arrives, or
 * when that one request failed, and nothing else.
 *
 * **Frontend gating is UX, not security.** Hiding a control is a courtesy; the
 * API refuses regardless. Nothing here is a boundary (D2).
 *
 * ── Per-project scope is a different question ──
 *
 * A permission answers "may this role ever do this". Whether this person may do
 * it to THIS project depends on their `ProjectMember` rows, and the API answers
 * that per resource with capability flags on the response (`canEdit`,
 * `canArchive`). Gate a screen from here; gate a row from its own flags.
 */
export function RoleProvider({
    role,
    permissions,
    children,
}: {
    role?: EnumDisplay;
    permissions?: string[];
    children: React.ReactNode;
}) {
    /**
     * A `Set<string>`, not `Set<PermissionKey>`, on purpose.
     *
     * The API is the authority on what capabilities exist. If it grows one
     * before `lib/config/rbac.ts` catches up, the string still lands here and
     * still matches, so the client cannot start refusing something the server
     * granted. The union is for autocomplete and typo safety, not a filter.
     */
    const granted = new Set<string>(
        permissions !== undefined
            ? permissions
            : role
              ? (ROLE_PERMISSIONS[role.value as RoleKey] ?? [])
              : [],
    );

    const effective = [...granted] as PermissionKey[];

    const value: RoleContextValue = {
        role,
        permissions: effective,
        can: (permission) => granted.has(permission),
        canAny: (perms) => perms.some((p) => granted.has(p)),
        canAll: (perms) => perms.length > 0 && perms.every((p) => granted.has(p)),
    };

    return (
        <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
    );
}

/**
 * Read the caller's capabilities.
 *
 * Returns the deny-all default outside a provider rather than throwing. A throw
 * would take down a screen over what is a presentation concern, and denying is
 * the safe direction.
 */
export function useRole(): RoleContextValue {
    return useContext(RoleContext);
}
