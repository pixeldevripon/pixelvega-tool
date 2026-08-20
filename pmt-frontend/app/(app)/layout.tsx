import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import DashboardShell from '@/components/shell/dashboard-shell';
import { DashboardSkeleton } from '@/components/skeletons/dashboard-skeleton';
import { getAppSession } from '@/lib/server/app-session';

/**
 * This layout authenticates, so it reads `headers()` and calls the backend on
 * every entry and can never produce a static shell. Next's guidance for a
 * layout requiring server-side data is to exempt it from instant validation,
 * which is what this marks.
 *
 * Be clear about what it does NOT buy: because `{children}` is nested inside
 * the async `AppContent` below, this exemption does not let pages under this
 * layout pass `unstable_instant: { prefetch: 'static' }` either. The build
 * still fails with INSTANT_VALIDATION_ERROR at the `headers()` call, and
 * scoping with `from: [...]` does not suppress it. Making any page here
 * instant-validatable requires lifting `{children}` out of this awaited
 * subtree first.
 *
 * Sidebar clicks are fast regardless: layouts are preserved across sibling
 * navigations, so this does not re-run on a route change. What it leaves on the
 * table is the cold load, which shows `DashboardSkeleton` until the session
 * resolves.
 */
export const unstable_instant = false;

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <Suspense fallback={<DashboardSkeleton />}>
            <AppContent>{children}</AppContent>
        </Suspense>
    );
}

async function AppContent({ children }: { children: React.ReactNode }) {
    const reqHeaders = await headers();
    const cookie = reqHeaders.get('cookie') || '';

    const session = await getAppSession(cookie);

    // The route guard in `proxy.ts` only checks that a cookie is PRESENT and
    // well shaped, deliberately, because it must make no network call. This is
    // where a stale or revoked cookie is actually caught.
    if (!session) {
        redirect('/login');
    }

    /**
     * Two gates, in this order, before anyone reaches the app.
     *
     * ── 1. A suspended account has a valid cookie and no business here ──
     *
     * Deleting the session server-side on suspension would be the other option,
     * but a suspension is reversible and forcing a re-login on reinstatement is
     * worse than checking here. The API refuses every request regardless; this
     * only stops the person staring at a shell of failing panels.
     *
     * ── 2. A temporary password must be replaced before anything else ──
     *
     * An invited account is created with `mustResetPassword: true`. Until it is
     * false, the person is holding the password an administrator generated,
     * which means it has existed in an inbox. `features.md`: "On first login,
     * the tool makes the person set their own password before they can
     * continue."
     *
     * Note this cannot be satisfied by the emailed token flow at
     * `/set-password`, because that path needs a token and this person has a
     * SESSION instead. So they go to the in-app change form, which asks for the
     * current password. Both paths clear the same flag through the backend's
     * two hooks.
     */
    if (session.status.value === 'SUSPENDED') {
        redirect('/account-suspended');
    }

    if (session.mustResetPassword) {
        redirect('/first-password');
    }

    return (
        <DashboardShell
            userName={session.name}
            userEmail={session.email}
            userRole={session.role}
            userPermissions={session.permissions}
            userImage={session.avatarUrl}>
            {children}
        </DashboardShell>
    );
}
