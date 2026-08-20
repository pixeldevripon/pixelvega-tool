'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
    cardClass,
    ErrorNote,
    Field,
    inputClass,
    PasswordInput,
    primaryBtn,
    quietLink,
} from '@/components/auth/auth-ui';
import { authClient } from '@/lib/auth-client';
import { safeRedirect } from '@/lib/safe-redirect';

/**
 * Sign in. One door, for all six roles.
 *
 * ── What this deliberately does NOT do ──
 *
 * It does not check, before or after the password is sent, whether this account
 * "belongs" on this screen. There is one door, so there is no wrong one. The
 * dashboard a person lands on is decided by `GET /users/me/permissions`, which
 * the shell reads after the session exists.
 *
 * It does not distinguish "no such account" from "wrong password". Both produce
 * the same sentence, because telling a stranger which emails are registered is
 * an enumeration oracle. better-auth already answers uniformly; this only makes
 * sure the client does not helpfully undo that.
 *
 * ── Where it sends people ──
 *
 * `?next=` is honoured so a deep link survives the sign-in, but only through
 * `safeRedirect`, which refuses anything that is not a same-origin path. An
 * open redirect on a login screen is a phishing primitive: it lets an attacker
 * send a real link to the real login page that lands on their page afterwards.
 */
export function SignInCard({ next }: { next?: string }) {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError('');

        /**
         * The try/catch is not defensive padding: `signIn.email` REJECTS rather
         * than returning `{ error }` when the failure is below the API (offline,
         * CORS, DNS, a proxy returning markup). Without it the rejection escapes
         * the handler, `setLoading(false)` never runs, and the button sits on
         * "Signing in…" forever with nothing said. That state was reproduced by
         * driving the real form, and it is silent: no toast, no field error,
         * nothing in the console a user would see.
         */
        try {
            const { error: authError } = await authClient.signIn.email({
                email,
                password,
            });

            if (authError) {
                // Rate limiting is the one case worth naming: "check your
                // password" is actively misleading when the real problem is
                // that the account is briefly locked out and waiting fixes it.
                const message = authError.message?.toLowerCase() ?? '';
                setError(
                    message.includes('rate') || message.includes('too many')
                        ? 'Too many attempts. Wait a minute and try again.'
                        : 'That email and password do not match an account.',
                );
                return;
            }

            // Not `push`: the login page must not sit in history behind the app,
            // or Back returns a signed-in user to a sign-in form. `refresh`
            // re-runs the app layout's server-side session read, which decides
            // whether they land on the app or on a forced password change.
            router.replace(safeRedirect(next, '/'));
            router.refresh();
        } catch {
            setError(
                'We could not reach the server. Check your connection and try again.',
            );
        } finally {
            // `finally`, so the navigation path clears it too. Leaving it set on
            // success is harmless only until the redirect is slow, at which
            // point the form looks hung at the moment it actually worked.
            setLoading(false);
        }
    }

    return (
        <div className={cardClass}>
            <h1 className='m-0 font-heading text-lg font-medium text-content'>
                Sign in
            </h1>
            <p className='mb-6 mt-1.5 text-sm text-content-muted'>
                Use the email your workspace invite was sent to.
            </p>

            <form onSubmit={handleSubmit} noValidate>
                <Field label='Email' htmlFor='email'>
                    <input
                        id='email'
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

                <PasswordInput
                    id='password'
                    label='Password'
                    autoComplete='current-password'
                    value={password}
                    onChange={setPassword}
                />

                <div className='mb-4 -mt-1 flex justify-end'>
                    <Link href='/login/forgot' className={quietLink}>
                        Forgot your password?
                    </Link>
                </div>

                {error && <ErrorNote>{error}</ErrorNote>}

                <button
                    type='submit'
                    disabled={loading}
                    className={`${primaryBtn} disabled:cursor-not-allowed disabled:opacity-60`}>
                    {loading ? 'Signing in…' : 'Sign in'}
                </button>
            </form>

            <p className='mt-6 text-center text-xs text-content-subtle'>
                Accounts are created by invitation. Ask an administrator if you
                do not have one.
            </p>
        </div>
    );
}
