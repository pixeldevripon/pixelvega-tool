import type { Metadata } from 'next';

import { SignOutButton } from '@/components/auth/sign-out-button';
import { AuthDeadEnd } from '@/components/auth/auth-ui';

export const metadata: Metadata = {
    title: 'Account suspended',
    robots: { index: false, follow: false },
};

/**
 * Where a SUSPENDED account lands.
 *
 * The session cookie is still valid, so the route guard lets them in and the app
 * layout sends them here rather than into a shell where every panel returns 403.
 * The API refuses them regardless; this only replaces a wall of failing requests
 * with a sentence that explains itself.
 *
 * No self-service route out, on purpose: reinstatement is an administrator's
 * decision, and offering a button that cannot work is worse than offering none.
 */
export default function AccountSuspendedPage() {
    return (
        <AuthDeadEnd
            title='Your account is suspended'
            body='You cannot sign in to the workspace while an account is suspended. An administrator can restore it.'
            action={<SignOutButton />}
        />
    );
}
