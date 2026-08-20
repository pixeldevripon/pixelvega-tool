import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AuthCardSkeleton } from '@/components/auth/auth-ui';
import { SignInCard } from '@/components/auth/sign-in-card';

export const metadata: Metadata = {
    title: 'Sign in',
    // A login page has nothing to index and being in a search result only
    // helps someone phishing for the real one.
    robots: { index: false, follow: false },
};

export default function SignInPage({
    searchParams,
}: {
    searchParams: Promise<{ next?: string }>;
}) {
    // `searchParams` is request-time data. With `cacheComponents: true` any
    // dynamic read must sit inside a <Suspense> boundary, so the shell
    // prerenders and only the card waits on the query string.
    return (
        <Suspense fallback={<AuthCardSkeleton />}>
            <SignInWithNext searchParams={searchParams} />
        </Suspense>
    );
}

async function SignInWithNext({
    searchParams,
}: {
    searchParams: Promise<{ next?: string }>;
}) {
    const { next } = await searchParams;
    return <SignInCard next={next} />;
}
