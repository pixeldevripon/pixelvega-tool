"use client";

import Link from "next/link";
import { KeyRound, X } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { userStore } from "@/lib/api/user-store";

function getPromptDismissedKey(userId: string) {
  return `pmt.passwordPrompt.dismissed.${userId}`;
}

function hasDismissedPrompt(userId: string) {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(getPromptDismissedKey(userId)) === "true";
}

function dismissPrompt(userId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getPromptDismissedKey(userId), "true");
}

export function PasswordChangePrompt() {
  const { currentUser } = useSyncExternalStore(
    userStore.subscribe,
    userStore.getSnapshot,
    userStore.getServerSnapshot,
  );
  const [dismissedUsers, setDismissedUsers] = useState<Set<string>>(
    () => new Set(),
  );

  const shouldRemind = currentUser?.mustResetPassword ?? false;
  const passwordHref = useMemo(() => "/change-password", []);
  const promptDismissed =
    !currentUser ||
    !currentUser.mustResetPassword ||
    dismissedUsers.has(currentUser.id) ||
    hasDismissedPrompt(currentUser.id);

  function skipForNow() {
    if (!currentUser) return;
    dismissPrompt(currentUser.id);
    setDismissedUsers((users) => new Set(users).add(currentUser.id));
  }

  if (!currentUser || !shouldRemind || promptDismissed) return null;

  return (
    <Alert className="mb-6" variant="warning">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
            <KeyRound size={22} />
          </div>
          <div>
            <AlertTitle>You are using a temporary password</AlertTitle>
            <AlertDescription className="max-w-2xl">
              Your account is active, but this password was generated for the
              invitation. Set a personal password when you have a moment.
            </AlertDescription>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-amber-300 bg-transparent text-amber-950 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-100 dark:hover:bg-amber-950"
            onClick={skipForNow}
          >
            <X size={17} />
            Skip
          </Button>
          <Link
            href={passwordHref}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-amber-900 px-4 text-sm font-bold text-white transition hover:bg-amber-800 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100"
          >
            <KeyRound size={17} />
            Change password
          </Link>
        </div>
      </div>
    </Alert>
  );
}
