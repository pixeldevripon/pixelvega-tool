"use client";

import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authApi } from "@/lib/api/auth";

export function ForgotPasswordView() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      // The API emails a single use LINK, not a code. It always answers 200,
      // whether or not the address exists, so nothing here reveals which.
      await authApi.requestPasswordReset(email);
      toast.success("Check your email", {
        description:
          "If that address has an account, a link to set a new password is on its way. It expires in an hour.",
      });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to send the OTP.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Forgot password
          </h1>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            Enter your work email to receive a verification OTP.
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

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Send OTP"}
          </Button>
        </form>

        <div className="text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-base font-bold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={18} />
            Back to login
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
