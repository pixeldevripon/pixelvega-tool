"use client";

import Link from "next/link";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { userStore } from "@/lib/api/user-store";

export function SettingsView() {
  const { currentUser, loadingCurrentUser, error } = useSyncExternalStore(
    userStore.subscribe,
    userStore.getSnapshot,
    userStore.getServerSnapshot,
  );

  useEffect(() => {
    void userStore.loadCurrentUser();
  }, []);

  if (!currentUser && loadingCurrentUser) {
    return (
      <section className="max-w-3xl rounded-lg border border-border bg-card p-6 shadow-sm">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-24 w-full" />
      </section>
    );
  }

  if (!currentUser) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {error ?? "Unable to load account settings."}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="text-3xl font-extrabold tracking-tight">Settings</h1>
        <p className="mt-2 text-base font-medium text-muted-foreground">
          Manage account preferences and sign-in security.
        </p>
      </section>

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-extrabold">Account security</h2>
                <Badge tone={currentUser.mustResetPassword ? "warning" : "success"}>
                  {currentUser.mustResetPassword
                    ? "Temporary password"
                    : "Password set"}
                </Badge>
              </div>
              <p className="mt-2 max-w-2xl text-sm font-medium text-muted-foreground">
                Change the password used to sign in to your workspace account.
              </p>
            </div>
          </div>

          <Link
            href="/change-password"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <KeyRound size={18} />
            Change password
          </Link>
        </div>

        {currentUser.mustResetPassword ? (
          <Alert className="mt-5" variant="warning">
            <AlertTitle>Temporary password still active</AlertTitle>
            <AlertDescription>
              You can keep working, but changing the system-generated password
              is recommended.
            </AlertDescription>
          </Alert>
        ) : null}
      </section>
    </div>
  );
}
