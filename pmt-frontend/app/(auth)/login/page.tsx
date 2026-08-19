"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail } from "lucide-react";
import { FormEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordInput } from "@/components/auth/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authApi } from "@/lib/api/auth";
import { userStore } from "@/lib/api/user-store";

export default function LoginPage() {
  const router = useRouter();
  const checkedExistingSessionRef = useRef(false);
  const {
    currentUser,
    authStatus,
    loadingCurrentUser,
    error: sessionError,
  } = useSyncExternalStore(
    userStore.subscribe,
    userStore.getSnapshot,
    userStore.getServerSnapshot,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (currentUser || authStatus === "authenticated") {
      if (checkedExistingSessionRef.current) {
        router.replace("/dashboard");
        return;
      }

      checkedExistingSessionRef.current = true;
      void userStore.loadCurrentUser({ force: true }).then((verifiedUser) => {
        if (verifiedUser) router.replace("/dashboard");
      });
      return;
    }

    if (authStatus === "idle") {
      void userStore.loadCurrentUser();
    }
  }, [authStatus, currentUser, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      await authApi.login(email, password);
      const verifiedUser = await userStore.loadCurrentUser({ force: true });
      if (!verifiedUser) {
        setError(
          userStore.getSnapshot().error ??
            "Unable to access this workspace account.",
        );
        return;
      }
      router.push("/dashboard");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (currentUser || authStatus === "authenticated") {
    return (
      <AuthShell>
        <p className="text-sm font-semibold text-muted-foreground">
          Redirecting to dashboard...
        </p>
      </AuthShell>
    );
  }

  if (loadingCurrentUser && authStatus === "loading") {
    return (
      <AuthShell>
        <p className="text-sm font-semibold text-muted-foreground">
          Checking your session...
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Sign in</h1>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            Use your workspace email and initial password.
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Email address
            </label>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              icon={<Mail size={20} />}
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-sm font-bold text-primary hover:text-primary/80"
              >
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              name="password"
              placeholder="••••••••"
              value={password}
              onChange={(value) => setPassword(value)}
            />
          </div>

          {error || (authStatus === "unauthenticated" && sessionError) ? (
            <Alert variant="destructive">
              <AlertDescription>
                {error || sessionError}
              </AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            <Lock size={18} />
            {isSubmitting ? "Signing in..." : "Login"}
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
