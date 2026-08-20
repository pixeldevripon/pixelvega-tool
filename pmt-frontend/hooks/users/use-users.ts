"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/fetch";
import type { MyPermissions } from "@/types/permissions";
import type { User } from "@/types/users";

/**
 * Queries for the users domain.
 *
 * The key factory is the whole point of this file. Every query and every
 * invalidation goes through it, because an inline `["users", "list", params]`
 * written at a call site drifts from the one written at the invalidation site,
 * and the symptom is a mutation that succeeds while the list it changed keeps
 * showing the old value. That failure is silent, which is what makes it
 * expensive.
 *
 * Read `userKeys.all` as a prefix: invalidating it invalidates every list and
 * every detail beneath it, which is what a role change should do.
 */
export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  detail: (userId: string) => [...userKeys.all, "detail", userId] as const,
  me: () => [...userKeys.all, "me"] as const,
  myPermissions: () => [...userKeys.all, "me", "permissions"] as const,
};

/** The signed-in user's own record. */
export function useCurrentUser() {
  return useQuery({
    queryKey: userKeys.me(),
    queryFn: () => apiFetch<User>("/api/users/me"),

    // A 401 here means the session has gone, and the app redirects rather than
    // retrying. `shouldRetryQuery` already refuses to retry a 4xx, so this is
    // only about not refetching it on every window focus while unauthenticated.
    retry: false,
  });
}

/**
 * The caller's effective capability set.
 *
 * This is what the UI gates from, never a role string (D2). The server computes
 * it from `ROLE_PERMISSIONS`, the same map `PermissionsGuard` consults, so a
 * button this hides and an endpoint that would have refused cannot disagree.
 *
 * Cached for five minutes rather than the default thirty seconds: a permission
 * set changes when an administrator changes someone's role, which is rare, and
 * refetching it on every window focus would mean an extra request on every
 * screen for a value that almost never moves.
 */
export function useMyPermissions() {
  return useQuery({
    queryKey: userKeys.myPermissions(),
    queryFn: () => apiFetch<MyPermissions>("/api/users/me/permissions"),
    staleTime: 5 * 60_000,
    retry: false,
  });
}
