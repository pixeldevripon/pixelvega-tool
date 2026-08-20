import { Suspense } from "react";
import { RoleProvider } from "@/contexts/role-context";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

/**
 * The permission set is fetched inside this layout rather than in the root one,
 * because the root also renders `/login` and `/forgot-password`, where there is
 * no session and the request would be a guaranteed 401 on every visit.
 *
 * Everything below the boundary depends on runtime data: `DashboardShell` reads
 * `usePathname()` to decide which nav item is current, and `RoleProvider` reads
 * the session's permission set. With Cache Components enabled, Next.js requires
 * that to sit inside `<Suspense>` and says why: without a boundary, the whole
 * document waits for it, so nothing at all is sent until the slowest part of
 * the page is ready. With one, the shell is prerendered and streamed
 * immediately and only the navigation fills in.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<DashboardShellFallback />}>
      <RoleProvider>
        <DashboardShell>{children}</DashboardShell>
      </RoleProvider>
    </Suspense>
  );
}

/**
 * The frame, without the parts that need a session.
 *
 * Shaped like the real shell (a sidebar column and a content column) so the
 * layout does not jump when the real one arrives. No spinner: a page that
 * flashes a spinner and then the same layout reads as slower than one that
 * simply appears.
 */
function DashboardShellFallback() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-64 shrink-0 border-r border-border bg-card lg:block" />
      <div className="flex-1" />
    </div>
  );
}
