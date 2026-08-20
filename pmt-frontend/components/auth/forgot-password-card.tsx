'use client';

import { ArrowLeft02Icon, Mail01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Link from 'next/link';
import { useState } from 'react';

import {
    cardClass,
    ErrorNote,
    Field,
    inputClass,
    primaryBtn,
} from '@/components/auth/auth-ui';
import { authClient } from '@/lib/auth-client';
import { RESET_TOKEN_TTL_MINUTES } from '@/lib/constants/auth';

/**
 * Request a password reset link.
 *
 * ── The success state is unconditional, and that is the point ──
 *
 * Whatever the API answers, this shows "check your inbox". Showing "no account
 * with that email" would turn this form into a membership oracle: anyone could
 * test an address and learn whether that person works here. The backend answers
 * uniformly for the same reason, so a client that helpfully reported the
 * difference would reopen the hole from the outside.
 *
 * The one exception is rate limiting. That is not about whether the account
 * exists, and silently showing success would leave someone waiting for an email
 * that was never sent.
 *
 * ── The link goes to /reset-password, and the path is not ours to choose ──
 *
 * The backend builds the email as `${APP_URL}/reset-password?token=...`
 * (`sendResetPassword` in `auth.instance.ts`). `redirectTo` below has to agree
 * with that route or every reset email lands on a 404.
 */
export function ForgotPasswordCard() {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError('');

        /**
         * The try/catch matters: better-auth's client REJECTS rather than
         * returning `{ error }` when the failure is below the API (offline,
         * CORS, a proxy returning markup). Without it the rejection escapes the
         * handler, the `finally` never runs, and the button sits on its loading
         * label forever with nothing said.
         */
        try {
            const { error: authError } = await authClient.requestPasswordReset({
                email,
                redirectTo: `${window.location.origin}/reset-password`,
            });

            const message = authError?.message?.toLowerCase() ?? '';
            if (message.includes('rate') || message.includes('too many')) {
                setError('Too many requests. Wait a minute and try again.');
                return;
            }

            setSent(true);
        } catch {
            setError(
                'We could not reach the server. Check your connection and try again.',
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className={cardClass}>
            <Link
                href='/login'
                className='mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-content-muted transition-colors hover:text-content'>
                <HugeiconsIcon
                    icon={ArrowLeft02Icon}
                    className='size-3.5'
                    strokeWidth={1.5}
                />
                Back to sign in
            </Link>

            <h1 className='m-0 font-heading text-lg font-medium text-content'>
                Reset your password
            </h1>
            <p className='mb-6 mt-1.5 text-sm text-content-muted'>
                We will email you a link to choose a new one.
            </p>

            {sent ? (
                <div className='flex gap-2 rounded-md bg-surface-raised px-3 py-3 text-sm text-content-muted'>
                    <HugeiconsIcon
                        icon={Mail01Icon}
                        className='mt-0.5 size-4 shrink-0'
                        strokeWidth={1.5}
                    />
                    <span>
                        If an account uses that email, a reset link is on its
                        way. It is valid for {RESET_TOKEN_TTL_MINUTES} minutes.
                    </span>
                </div>
            ) : (
                <form onSubmit={handleSubmit} noValidate>
                    <Field label='Email' htmlFor='forgot-email'>
                        <input
                            id='forgot-email'
                            aria-label='Email'
                            type='email'
                            name='email'
                            autoComplete='username'
                            inputMode='email'
                            placeholder='you@pixelvega.com'
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className={inputClass}
                        />
                    </Field>

                    {error && <ErrorNote>{error}</ErrorNote>}

                    <button
                        type='submit'
                        disabled={loading}
                        className={`${primaryBtn} disabled:cursor-not-allowed disabled:opacity-60`}>
                        {loading ? 'Sending…' : 'Email me a link'}
                    </button>
                </form>
            )}
        </div>
    );
}
