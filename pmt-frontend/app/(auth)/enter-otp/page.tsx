"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, RotateCcw, ShieldCheck } from "lucide-react";
import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/api/auth";

const RESEND_COOLDOWN_SECONDS = 60;

function EnterOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "your work email";
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(
    RESEND_COOLDOWN_SECONDS,
  );
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const isComplete = otp.every(Boolean);
  const canResend = resendCooldown <= 0 && email !== "your work email";

  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = window.setInterval(() => {
      setResendCooldown((seconds) => Math.max(seconds - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = otp.join("");
    if (value.length !== 6 || email === "your work email") {
      setError("Enter the 6-digit OTP.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const result = await authApi.verifyOtp(email, value);
      window.sessionStorage.setItem("pmt.resetToken", result.resetToken);
      router.push("/change-password?flow=reset");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Invalid OTP.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendOtp() {
    if (!canResend) return;

    setIsResending(true);
    setError("");

    try {
      await authApi.requestPasswordOtp(email);
      setOtp(["", "", "", "", "", ""]);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success("New OTP sent", {
        description: "Use the latest code from your email.",
      });
      inputRefs.current[0]?.focus();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to resend the OTP.",
      );
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Enter OTP</h1>
        <p className="mt-2 text-sm font-semibold text-muted-foreground">
          We sent a 6-digit code to {email}.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="grid grid-cols-6 gap-2">
          {otp.map((value, index) => (
            <input
              key={index}
              ref={(element) => {
                inputRefs.current[index] = element;
              }}
              inputMode="numeric"
              maxLength={1}
              value={value}
              onFocus={() => {
                const firstEmptyIndex = otp.findIndex((digit) => !digit);
                if (firstEmptyIndex >= 0 && index > firstEmptyIndex) {
                  inputRefs.current[firstEmptyIndex]?.focus();
                }
              }}
              onChange={(event) => {
                const digit = event.target.value.replace(/\D/g, "").slice(-1);
                if (!digit) return;
                const next = [...otp];
                next[index] = digit;
                setOtp(next);
                window.requestAnimationFrame(() => {
                  inputRefs.current[index + 1]?.focus();
                });
                setError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Backspace") {
                  event.preventDefault();
                  const next = [...otp];
                  if (next[index]) {
                    next[index] = "";
                    setOtp(next);
                    return;
                  }
                  const previous = Math.max(index - 1, 0);
                  next[previous] = "";
                  setOtp(next);
                  inputRefs.current[previous]?.focus();
                }
              }}
              onPaste={(event) => {
                event.preventDefault();
                const pasted = event.clipboardData
                  .getData("text")
                  .replace(/\D/g, "")
                  .slice(0, 6);
                if (!pasted) return;
                const next = ["", "", "", "", "", ""];
                pasted.split("").forEach((digit, digitIndex) => {
                  next[digitIndex] = digit;
                });
                setOtp(next);
                inputRefs.current[Math.min(pasted.length, 5)]?.focus();
              }}
              className="h-11 rounded-md border border-border bg-input text-center text-lg font-extrabold outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              aria-label={`OTP digit ${index + 1}`}
            />
          ))}
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={!isComplete || isSubmitting}
        >
          <ShieldCheck size={18} />
          {isSubmitting ? "Verifying..." : "Verify OTP"}
        </Button>
      </form>

      <div className="space-y-4 text-center">
        <div className="rounded-lg border border-border bg-muted/60 px-4 py-3">
          <p className="text-sm font-semibold text-muted-foreground">
            Did not get the code?
          </p>
          {canResend ? (
            <Button
              className="mt-3"
              variant="outline"
              onClick={handleResendOtp}
              disabled={isResending}
            >
              <RotateCcw size={17} />
              {isResending ? "Sending..." : "Resend OTP"}
            </Button>
          ) : (
            <p className="mt-2 text-sm font-bold text-foreground">
              Resend available in {resendCooldown}s
            </p>
          )}
        </div>

        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-base font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={18} />
          Back to login
        </Link>
      </div>
    </div>
  );
}

export default function EnterOtpPage() {
  return (
    <AuthShell>
      <Suspense>
        <EnterOtpForm />
      </Suspense>
    </AuthShell>
  );
}
