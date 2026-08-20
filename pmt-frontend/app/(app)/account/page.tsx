import type { Metadata } from 'next';

import { AccountView } from '@/components/account/account-view';

export const metadata: Metadata = {
    title: 'Account & User Management',
};

/**
 * The account screen.
 *
 * A Server Component that renders the page header and the view, and nothing
 * else. It does not fetch: the profile, the options and the session list are all
 * client queries, so a save updates the screen without a navigation and the
 * session list can refetch when the tab regains focus.
 *
 * There is no session check here. `app/(app)/layout.tsx` has already resolved
 * one, redirected an unauthenticated caller to `/login`, and refused a suspended
 * account. Repeating it would be a second round trip for an answer this subtree
 * already has.
 */
export default function AccountPage() {
    return (
        <div className='w-full'>
            <header className='mb-8'>
                <h1 className='text-xl font-semibold tracking-tight'>
                    Account &amp; User Management
                </h1>
                <p className='mt-1 text-sm text-content-muted'>
                    Manage your account settings and user preferences.
                </p>
            </header>
            <AccountView />
        </div>
    );
}
