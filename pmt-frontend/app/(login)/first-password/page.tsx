import type { Metadata } from 'next';

import { FirstPasswordCard } from '@/components/auth/first-password-card';

export const metadata: Metadata = {
    title: 'Set your password',
    robots: { index: false, follow: false },
};

/**
 * Guarded, deliberately: it is NOT in `proxy.ts`'s unguarded list, because
 * reaching it requires a session. Someone with no session belongs at `/login`.
 */
export default function FirstPasswordPage() {
    return <FirstPasswordCard />;
}
