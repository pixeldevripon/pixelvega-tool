'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { primaryBtn } from '@/components/auth/auth-ui';
import { authClient } from '@/lib/auth-client';

/**
 * Sign out, from a screen that is not the app shell.
 *
 * The shell's identity dropdown has its own copy of this. It stays separate
 * because this one has to work on a screen where the dropdown is not mounted:
 * the suspended-account dead end being the case that matters.
 */
export function SignOutButton({ label = 'Sign out' }: { label?: string }) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);

    async function handleSignOut() {
        setLoading(true);
        // Sign out is attempted, then the client navigates REGARDLESS. If the
        // call fails the cookie may survive, but leaving someone stuck on a
        // dead-end screen because sign-out 500'd is worse: the route guard and
        // the layout both re-check on arrival, so a surviving cookie sends them
        // straight back here rather than into the app.
        try {
            await authClient.signOut();
        } catch {
            // Deliberately swallowed. See above.
        }
        // Clear before navigating, or the next person to sign in on this
        // browser sees the previous session's rows from cache for a frame.
        queryClient.clear();
        router.replace('/login');
        router.refresh();
    }

    return (
        <button
            type='button'
            onClick={handleSignOut}
            disabled={loading}
            className={`${primaryBtn} disabled:cursor-not-allowed disabled:opacity-60`}>
            {loading ? 'Signing out…' : label}
        </button>
    );
}
