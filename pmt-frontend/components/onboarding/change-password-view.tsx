"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { FormEvent, Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordInput } from "@/components/auth/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/api/auth";
import { userStore } from "@/lib/api/user-store";
import { usersApi } from "@/lib/api/users";
import { roleLabels } from "@/lib/auth-meta";

function ChangePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser: user, loadingCurrentUser } = useSyncExternalStore(
    userStore.subscribe,
    userStore.getSnapshot,
    userStore.getServerSnapshot,
  );
  const isResetFlow = searchParams.get("flow") === "reset";
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const backHref = isResetFlow || !user ? "/login" : "/dashboard/settings";
  const backLabel = isResetFlow || !user ? "Back to login" : "Back to settings";

  useEffect(() => {
    if (!isResetFlow) {
      void userStore.loadCurrentUser({ force: true });
    }
  }, [isResetFlow]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: string[] = [];
    if (!isResetFlow && !currentPassword) {
      nextErrors.push("Current password is required.");
    }
    if (newPassword.length < 8) {
      nextErrors.push("Password must be at least 8 characters.");
    }
    if (newPassword !== confirmPassword) {
      nextErrors.push("Confirm password must match new password.");
    }
    if (nextErrors.length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors([]);

    try {
      if (isResetFlow) {
        const resetToken = window.sessionStorage.getItem("pmt.resetToken");
        if (!resetToken) {
          setErrors(["Reset session expired. Please request a new OTP."]);
          return;
        }
        await authApi.resetPassword(resetToken, newPassword);
        window.sessionStorage.removeItem("pmt.resetToken");
        toast.success("Password updated", {
          description: "Sign in again with your new password.",
        });
        router.push("/login");
        return;
      }

      await usersApi.changePassword(currentPassword, newPassword);
      await userStore.loadCurrentUser({ force: true });
      toast.success("Password updated", {
        description: "Your workspace password has been changed.",
      });
      router.push("/dashboard");
    } catch (error) {
      setErrors([
        error instanceof Error ? error.message : "Unable to update password.",
      ]);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isResetFlow && loadingCurrentUser) {
    return (
      <AuthShell wide>
        <p className="text-sm font-semibold text-muted-foreground">
          Loading account...
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell wide>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Set new password
          </h1>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            {isResetFlow
              ? "Update your password, then sign in again."
              : "Choose a strong password for your workspace account."}
          </p>
        </div>

        {!isResetFlow && user ? (
          <div className="grid gap-4 rounded-xl bg-muted p-5 sm:grid-cols-[120px_1fr]">
            <div className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
              Email
            </div>
            <div className="break-all text-base font-extrabold">{user.email}</div>
            <div className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
              Role
            </div>
            <div>
              <Badge tone="primary">{roleLabels[user.role]}</Badge>
            </div>
          </div>
        ) : null}

        <form className="space-y-6" onSubmit={handleSubmit}>
          {!isResetFlow ? (
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Current Password
              </label>
              <PasswordInput
                name="currentPassword"
                placeholder="Temporary or current password"
                value={currentPassword}
                onChange={(value) => {
                  setCurrentPassword(value);
                  setErrors([]);
                }}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
              New Password
            </label>
            <PasswordInput
              name="newPassword"
              placeholder="Minimum 8 characters"
              value={newPassword}
              onChange={(value) => {
                setNewPassword(value);
                setErrors([]);
              }}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Confirm Password
            </label>
            <PasswordInput
              name="confirmPassword"
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(value) => {
                setConfirmPassword(value);
                setErrors([]);
              }}
            />
          </div>

          {errors.length > 0 ? (
            <Alert variant="destructive">
              <AlertDescription>
              {errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
              </AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            <CheckCircle2 size={18} />
            {isSubmitting ? "Updating..." : "Update Password"}
          </Button>
        </form>

        <div className="text-center">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-base font-bold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={18} />
            {backLabel}
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}

export function ChangePasswordView() {
  return (
    <Suspense>
      <ChangePasswordForm />
    </Suspense>
  );
}
