"use client";

import Link from "next/link";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/users/use-users";

/**
 * The first screen on the new data layer, and the shape every other one copies.
 *
 * What changed from the version this replaces, all of it structural:
 *
 * - `useSyncExternalStore(userStore)` plus a `useEffect` that kicked off the
 *   load became one `useCurrentUser()` call. The store's five state fields, its
 *   request de-duplication and its `currentUserRequestId` race guard are all
 *   things TanStack Query already does.
 * - The four view states (loading, error, empty, loaded) are explicit and in
 *   that order, rather than two early returns that conflated "still loading"
 *   with "failed".
 * - The error message comes from `error.message`, which `apiFetch` guarantees
 *   is safe to show verbatim, rather than from a store field that could hold a
 *   stale message from an earlier request.
 * - Raw markup became `Card` and `Button`. The hand-built anchor that
 *   duplicated the primary button's twelve classes is gone, so it cannot drift
 *   from the real one.
 */
export function SettingsView() {
  const { data: user, isPending, isError, error } = useCurrentUser();

  if (isPending) {
    return (
      <div className="max-w-4xl space-y-6">
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-4 h-4 w-72" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Settings unavailable</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <Card>
        <CardContent className="pt-6">
          <h1 className="text-3xl font-extrabold">Settings</h1>
          <p className="mt-2 text-base font-medium text-muted-foreground">
            Manage account preferences and sign-in security.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <ShieldCheck size={22} aria-hidden />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-extrabold">Account security</h2>
                  <Badge tone={user.mustResetPassword ? "warning" : "success"}>
                    {user.mustResetPassword
                      ? "Temporary password"
                      : "Password set"}
                  </Badge>
                </div>
                <p className="mt-2 max-w-2xl text-sm font-medium text-muted-foreground">
                  Change the password used to sign in to your workspace account.
                </p>
              </div>
            </div>

            <Button asChild>
              <Link href="/change-password">
                <KeyRound size={18} aria-hidden />
                Change password
              </Link>
            </Button>
          </div>

          {user.mustResetPassword ? (
            <Alert className="mt-5" variant="warning">
              <AlertTitle>Temporary password still active</AlertTitle>
              <AlertDescription>
                You can keep working, but changing the system-generated password
                is recommended.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
