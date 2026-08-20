import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AuthCardSkeleton } from '@/components/auth/auth-ui';
import { NewPasswordCard } from '@/components/auth/new-password-card';

export const metadata: Metadata = {
    title: 'Set a new password',
    robots: { index: false, follow: false },
};

/**
 * Where the reset email lands. The path is fixed by the backend, which builds
 * the link as `${APP_URL}/reset-password?token=...` in `sendResetPassword`.
 * Renaming this route breaks every email already in an inbox.
 */
export default function NewPasswordPage({
    searchParams,
}: {
    searchParams: Promise<{ state?: string }>;
}) {
    return (
        <Suspense fallback={<AuthCardSkeleton />}>
            <Card searchParams={searchParams} />
        </Suspense>
    );
}

async function Card({
    searchParams,
}: {
    searchParams: Promise<{ state?: string }>;
}) {
    const { state } = await searchParams;
    return <NewPasswordCard mode='reset' expired={state === 'expired'} />;
}
