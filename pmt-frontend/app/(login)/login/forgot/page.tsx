import type { Metadata } from 'next';

import { ForgotPasswordCard } from '@/components/auth/forgot-password-card';

export const metadata: Metadata = {
    title: 'Reset your password',
    robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
    return <ForgotPasswordCard />;
}
