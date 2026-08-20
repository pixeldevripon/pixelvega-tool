'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import {
    AuthDeadEnd,
    cardClass,
    ErrorNote,
    PasswordInput,
    primaryBtn,
} from '@/components/auth/auth-ui';
import { SuccessBlock } from '@/components/common/success-block';
import { authClient } from '@/lib/auth-client';
import {
    MIN_PASSWORD_LENGTH,
    RESET_TOKEN_TTL_MINUTES,
} from '@/lib/constants/auth';

/**
 * Choose a password from an emailed token. Serves BOTH doors:
 *
 * - `/set-password` — the first password, from an invite email
 * - `/reset-password` — a replacement, from a forgot-password email
 *
 * ── Why one component for two routes ──
 *
 * They are the same operation. `sendResetPassword` in the backend mints one
 * token and only varies the email it sends: an invite when the call had no HTTP
 * request behind it, a reset when it did. Both land on
 * `POST /api/auth/reset-password`, and both clear `mustResetPassword` through
 * the same `onPasswordReset` hook. Two components would be two copies of one
 * state machine, differing only in a heading.
 *
 * ── Every other session is revoked, and the copy has to say so ──
 *
 * `revokeSessionsOnPasswordReset: true` on the backend. A reset means the old
 * password is presumed compromised, so every other session for that account
 * goes with it. Someone who resets on their laptop and finds their phone
 * signed out should have been told that would happen.
 */
export function NewPasswordCard({
    mode,
    expired = false,
}: {
    mode: 'invite' | 'reset';
    /** The server resolved `?state=expired` before rendering. */
    expired?: boolean;
}) {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [done, setDone] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [tokenDead, setTokenDead] = useState(false);

    const isInvite = mode === 'invite';

    if (expired || tokenDead) {
        return (
            <AuthDeadEnd
                title='This link has expired'
                body={`Links are valid for ${RESET_TOKEN_TTL_MINUTES} minutes. Request a new one and it will arrive in a moment.`}
                action={
                    <Link href='/login/forgot' className={primaryBtn}>
                        Request a new link
                    </Link>
                }
            />
        );
    }

    if (!token) {
        return (
            <AuthDeadEnd
                title='That link is not valid'
                body={
                    isInvite
                        ? 'This invite link is incomplete or has already been used. Ask an administrator to send it again.'
                        : 'This reset link is incomplete or has already been used.'
                }
                action={
                    <Link href='/login/forgot' className={primaryBtn}>
                        Request a new link
                    </Link>
                }
            />
        );
    }

    if (done) {
        return (
            <div className={cardClass}>
                <SuccessBlock
                    title={
                        isInvite ? 'Your password is set.' : 'Password updated.'
                    }
                    body='We signed out your other sessions, so sign in with the new password.'
                    loginHref='/login'
                    loginLabel='Go to sign in'
                />
            </div>
        );
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        // A convenience check, not the gate. The API enforces the same rule and
        // wins if the two ever disagree (D5).
        if (password.length < MIN_PASSWORD_LENGTH) {
            setError(
                `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
            );
            return;
        }

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
            const { error: authError } = await authClient.resetPassword({
                newPassword: password,
                token: token!,
            });

            if (authError) {
                const message = authError.message?.toLowerCase() ?? '';
                // A token can die between opening the email and submitting the
                // form. Swap to the dead-end state rather than showing a
                // validation error on a field filled in correctly.
                if (
                    message.includes('expired') ||
                    message.includes('invalid') ||
                    message.includes('not found')
                ) {
                    setTokenDead(true);
                    return;
                }
                setError(
                    authError.message || 'That password could not be saved.',
                );
                return;
            }

            setDone(true);
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
            <h1 className='m-0 font-heading text-lg font-medium text-content'>
                {isInvite ? 'Choose your password' : 'Set a new password'}
            </h1>
            <p className='mb-6 mt-1.5 text-sm text-content-muted'>
                {isInvite
                    ? 'One step and your account is ready.'
                    : 'Pick something you do not use anywhere else.'}
            </p>

            <form onSubmit={handleSubmit} noValidate>
                <PasswordInput
                    id='new-password'
                    label={isInvite ? 'Password' : 'New password'}
                    autoComplete='new-password'
                    value={password}
                    onChange={setPassword}
                    minLength={MIN_PASSWORD_LENGTH}
                    hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
                />

                {error && <ErrorNote>{error}</ErrorNote>}

                <button
                    type='submit'
                    disabled={loading}
                    className={`${primaryBtn} disabled:cursor-not-allowed disabled:opacity-60`}>
                    {loading
                        ? 'Saving…'
                        : isInvite
                          ? 'Set password and continue'
                          : 'Update password'}
                </button>
            </form>
        </div>
    );
}
