import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function AuthShell({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <main className="auth-bg min-h-screen px-5 py-8">
      <div className="mx-auto flex w-full justify-end">
        <ThemeToggle />
      </div>
      <section className="flex min-h-[calc(100vh-88px)] items-center justify-center py-6">
        <div
          className={`w-full rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm ${
            wide ? "max-w-[430px]" : "max-w-[360px]"
          }`}
        >
          {children}
        </div>
      </section>
    </main>
  );
}
