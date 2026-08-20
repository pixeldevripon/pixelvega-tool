import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginView } from "@/components/auth/login-view";

/**
 * A Server Component, as every `page.tsx` in this app is.
 *
 * The form itself has to be a client component, and the boundary belongs at the
 * lowest leaf that needs it rather than on the route. Wrapping it in
 * `<Suspense>` is not decoration: `LoginView` reads `?next=` through
 * `useSearchParams`, and Next.js refuses to prerender a page that reads the
 * query string outside a boundary, because the shell cannot be static if its
 * content depends on the URL. With the boundary, the shell prerenders and only
 * the form waits.
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthShell>
          <p className="text-sm font-semibold text-muted-foreground">
            Loading sign in...
          </p>
        </AuthShell>
      }
    >
      <LoginView />
    </Suspense>
  );
}
