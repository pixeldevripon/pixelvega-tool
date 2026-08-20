'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
    cardClass,
    ErrorNote,
    PasswordInput,
    primaryBtn,
} from '@/components/auth/auth-ui';
import { authClient } from '@/lib/auth-client';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants/auth';

/**
 * Replace the temporary password an invite created, while signed in.
 *
 * ── Why this exists alongside `/set-password` ──
 *
 * Both replace an invited account's first password, but they arrive with
 * different credentials and so cannot share an endpoint:
 *
 * - `/set-password` has an emailed TOKEN and no session. It calls
 *   `reset-password`.
 * - this screen has a SESSION and no token, because the person signed in with
 *   the temporary password they were given. `change-password` is the only route
 *   that accepts that, and it requires the current password.
 *
 * Both clear `mustResetPassword`, through the backend's two separate hooks. Miss
 * either and a user is prompted forever to change a password they just chose.
 *
 * ── There is no skip ──
 *
 * `features.md`: "On first login, the tool makes the person set their own
 * password before they can continue." The app layout redirects here while the
 * flag is set, so a skip button would only produce a loop. The honest design is
 * not to offer one.
 */
export function FirstPasswordCard() {
    const router = useRouter();
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        if (next.length < MIN_PASSWORD_LENGTH) {
            setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
            return;
        }
        if (next === current) {
            setError('Choose a password different from the temporary one.');
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
            const { error: authError } = await authClient.changePassword({
                currentPassword: current,
                newPassword: next,
                // Keep THIS session alive and drop the others. Revoking all of
                // them would sign the person out of the screen they are
                // standing on, and the next thing they would see is a login
                // form with no explanation.
                revokeOtherSessions: true,
            });

            if (authError) {
                const message = authError.message?.toLowerCase() ?? '';
                setError(
                    message.includes('invalid') || message.includes('incorrect')
                        ? 'That temporary password is not right. Check the invite email.'
                        : authError.message ||
                          'That password could not be saved.',
                );
                return;
            }

            // `refresh` re-runs the app layout's session read, which is what
            // sees `mustResetPassword` is now false and stops redirecting here.
            router.replace('/');
            router.refresh();
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
                Set your own password
            </h1>
            <p className='mb-6 mt-1.5 text-sm text-content-muted'>
                Your account is using a temporary password. Replace it to
                continue.
            </p>

            <form onSubmit={handleSubmit} noValidate>
                <PasswordInput
                    id='current-password'
                    label='Temporary password'
                    autoComplete='current-password'
                    value={current}
                    onChange={setCurrent}
                />
                <PasswordInput
                    id='next-password'
                    label='New password'
                    autoComplete='new-password'
                    value={next}
                    onChange={setNext}
                    minLength={MIN_PASSWORD_LENGTH}
                    hint={`At least ${MIN_PASSWORD_LENGTH} characters. Your other sessions will be signed out.`}
                />

                {error && <ErrorNote>{error}</ErrorNote>}

                <button
                    type='submit'
                    disabled={loading}
                    className={`${primaryBtn} disabled:cursor-not-allowed disabled:opacity-60`}>
                    {loading ? 'Saving…' : 'Save and continue'}
                </button>
            </form>
        </div>
    );
}
