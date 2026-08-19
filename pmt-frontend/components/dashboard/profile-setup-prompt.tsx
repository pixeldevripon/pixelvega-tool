"use client";

import { useRouter } from "next/navigation";
import { UserRoundCheck } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { profilesApi } from "@/lib/api/profiles";
import { userStore } from "@/lib/api/user-store";
import { isProfileComplete } from "@/lib/profile-utils";
import type { UserProfile } from "@/types/auth";

type ProfileCheckState = {
  status: "idle" | "ready" | "error";
  userId: string | null;
  profile: UserProfile | null;
};

export function ProfileSetupPrompt() {
  const router = useRouter();
  const { currentUser: user } = useSyncExternalStore(
    userStore.subscribe,
    userStore.getSnapshot,
    userStore.getServerSnapshot,
  );
  const [dismissed, setDismissed] = useState(false);
  const [profileCheck, setProfileCheck] = useState<ProfileCheckState>({
    status: "idle",
    userId: null,
    profile: null,
  });

  useEffect(() => {
    if (!user) return;

    let active = true;
    void profilesApi
      .me()
      .then((result) => {
        if (!active) return;
        setProfileCheck({
          status: "ready",
          userId: user.id,
          profile: result,
        });
      })
      .catch(() => {
        if (!active) return;
        setProfileCheck({
          status: "error",
          userId: user.id,
          profile: null,
        });
      });

    return () => {
      active = false;
    };
  }, [user]);

  if (!user) return null;
  if (dismissed) return null;

  const isCheckingProfile =
    profileCheck.userId !== user.id || profileCheck.status === "idle";

  if (isCheckingProfile) {
    return (
      <section className="mb-6 flex items-center gap-4 rounded-lg border border-border bg-card p-5 shadow-sm">
        <Skeleton className="h-11 w-11 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-3 h-3 w-full max-w-xl" />
        </div>
      </section>
    );
  }

  if (isProfileComplete(profileCheck.profile)) return null;

  return (
    <section className="mb-6 flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-sm md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <UserRoundCheck size={22} />
        </div>
        <div>
          <h2 className="font-extrabold">Set up your profile</h2>
          <p className="mt-1 max-w-2xl text-sm font-medium text-muted-foreground">
            Add your role-specific profile details so teammates can reach the
            right person quickly.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setDismissed(true)}>
          Skip
        </Button>
        <Button onClick={() => router.push("/dashboard/profile")}>Proceed</Button>
      </div>
    </section>
  );
}
