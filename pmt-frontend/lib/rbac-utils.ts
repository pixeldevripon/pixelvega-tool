import type { IconSvgElement } from '@hugeicons/react';
/**
 * Filters a navigation tree so only items the user has permission to see are shown.
 * An item is visible if:
 *   - It has no `permissions` array (always visible)
 *   - The user holds at least one of the item's required permissions
 *
 * The filter is applied recursively so child items are also filtered.
 * A parent item that requires no permission but whose ALL children are hidden
 * is itself removed from the tree.
 */

export interface NavItem {
  title: string;
  url?: string;
  icon?: IconSvgElement;
  isActive?: boolean;
  permissions?: string[];
  items?: NavItem[];
  badge?: string | number;
}

/** A labelled sidebar section (04 §1.2). */
export interface NavGroup {
  label?: string;
  items: NavItem[];
}

/**
 * Filters each group's items, then drops groups left empty - a group header
 * must never render over nothing: for a CLIENT, Deliver and Configure are
 * Configure are absent, not greyed).
 */
export function filterNavGroups(
  groups: NavGroup[] | undefined,
  userPermissions: string[]
): NavGroup[] {
  if (!groups || !Array.isArray(groups)) return [];
  return groups
    .map((group) => ({
      ...group,
      items: filterNavigationByPermissions(group.items, userPermissions),
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * The permission set to gate UI with: the backend's EFFECTIVE grants when we
 * have them (fine-grained staff seats), the static role map only as a
 * transient-failure fallback - except STAFF, whose fallback is empty rather
 * than the broad legacy list, since guessing wide for a staff seat shows them
 * doors their seat may not open. Backend guards enforce regardless; this only
 * decides what we render.
 *
 * Shared by the sidebar and the command palette so a staff member cannot see
 * an entry in one surface that the other correctly hides.
 */
export function resolvePermissions(
  role: string | undefined,
  userPermissions: string[] | undefined,
  roleMap: Record<string, string[]>
): string[] {
  if (userPermissions) return userPermissions;
  return roleMap[role ?? ''] ?? [];
}

/**
 * The door helpers that used to live here are gone. There is one sign-in URL,
 * so "which door did this session enter through" has no answer to give and
 * nothing to decide with it. Sign-out goes to `/login`, unconditionally.
 */

/**
 * The navigation a permission set may see.
 *
 * Shared by the sidebar and the command palette so neither can show an entry
 * the other correctly hides. That is the whole reason it is a function here
 * rather than a filter inlined in each component.
 */
export function navGroupsForRole(
  nav: { dashboard: NavGroup[] },
  userPermissions: string[]
): NavGroup[] {
  return filterNavGroups(nav.dashboard, userPermissions);
}

/**
 * Filters a list of nav items, recursing into children.
 *
 * A parent that requires no permission of its own but whose children are ALL
 * filtered out is dropped too: a group header over nothing, or a expandable
 * row that expands to nothing, reads as a broken screen rather than as an
 * absent capability.
 */
export function filterNavigationByPermissions(
  items: NavItem[] | undefined,
  userPermissions: string[]
): NavItem[] {
  if (!items || !Array.isArray(items)) return [];

  return items.reduce<NavItem[]>((acc, item) => {
    const hasPermission =
      !item.permissions ||
      item.permissions.length === 0 ||
      item.permissions.some((p) => userPermissions.includes(p));

    if (!hasPermission) return acc;

    const filteredChildren = item.items
      ? filterNavigationByPermissions(item.items, userPermissions)
      : undefined;

    if (item.items && item.items.length > 0 && filteredChildren?.length === 0) {
      return acc;
    }

    acc.push(filteredChildren ? { ...item, items: filteredChildren } : item);
    return acc;
  }, []);
}
