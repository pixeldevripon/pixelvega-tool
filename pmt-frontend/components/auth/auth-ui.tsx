'use client';

import { AlertCircleIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useState } from 'react';

/**
 * The shared pieces of every auth screen: the card, the labelled field, the
 * password input with its reveal toggle, the error note, and the two button
 * styles.
 *
 * ── Why these are plain classes and not `components/ui` primitives ──
 *
 * The auth screens are the only surface a signed-out person sees, and they
 * render before any provider is mounted. Keeping them on the semantic tokens
 * directly means no auth screen can break because a primitive changed, and it
 * keeps the sign-in path free of the component tree the dashboard needs.
 *
 * Every colour here is a token. There is no separate auth palette: the door
 * uses the same purple as the app behind it, so signing in does not feel like
 * arriving from a different product.
 */

export const cardClass =
    'w-full rounded-xl border border-line bg-surface-overlay px-8 pb-6 pt-8 shadow-md';

export const inputClass =
    'w-full rounded-md border border-line bg-surface px-3 py-2.5 text-base text-content transition-colors placeholder:text-content-subtle focus:border-primary focus:outline-2 focus:outline-offset-1 focus:outline-primary';

export const primaryBtn =
    'mt-1 flex w-full items-center justify-center rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-content transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring';

export const quietLink =
    'text-sm font-medium text-content-muted underline-offset-2 transition-colors hover:text-primary hover:underline';

export function Field({
    label,
    htmlFor,
    hint,
    children,
}: {
    label: string;
    htmlFor: string;
    /** Shown under the input. Use it for a rule, not for reassurance. */
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <div className='mb-4'>
            <label
                htmlFor={htmlFor}
                className='mb-1.5 block text-sm font-medium text-content'>
                {label}
            </label>
            {children}
            {hint && (
                <p className='mt-1.5 text-xs text-content-muted'>{hint}</p>
            )}
        </div>
    );
}

/**
 * A password input with a reveal toggle.
 *
 * The toggle is a real `<button type='button'>` rather than an icon on a div,
 * so it is reachable by keyboard and announced. `aria-live='polite'` means the
 * label change is read out, which is the only feedback a screen reader user
 * gets that the field is now visible.
 */
export function PasswordInput({
    id,
    label,
    autoComplete,
    value,
    onChange,
    minLength,
    hint,
}: {
    id: string;
    label: string;
    autoComplete: 'current-password' | 'new-password';
    value: string;
    onChange: (value: string) => void;
    minLength?: number;
    hint?: string;
}) {
    const [shown, setShown] = useState(false);

    return (
        <Field label={label} htmlFor={id} hint={hint}>
            <div className='relative'>
                <input
                    id={id}
                    aria-label={label}
                    type={shown ? 'text' : 'password'}
                    name='password'
                    autoComplete={autoComplete}
                    minLength={minLength}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    required
                    className={`${inputClass} pr-16`}
                />
                <button
                    type='button'
                    aria-live='polite'
                    onClick={() => setShown((v) => !v)}
                    className='absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm px-2.5 py-1.5 text-xs font-medium text-content-muted transition-colors hover:bg-surface-raised hover:text-content'>
                    {shown ? 'Hide' : 'Show'}
                </button>
            </div>
        </Field>
    );
}

/**
 * `role='alert'` so the message is announced the moment it appears. Without it
 * a failed sign-in is silent to a screen reader: the button stops spinning and
 * nothing says why.
 */
export function ErrorNote({ children }: { children: React.ReactNode }) {
    return (
        <p
            role='alert'
            className='mb-4 flex items-start gap-2 rounded-md border border-danger-border bg-danger-subtle px-3 py-2.5 text-sm text-danger-fg'>
            <HugeiconsIcon
                icon={AlertCircleIcon}
                className='mt-0.5 size-4 shrink-0'
                strokeWidth={1.75}
            />
            <span>{children}</span>
        </p>
    );
}

/** The dead-end states: an invalid token, an expired one. */
export function AuthDeadEnd({
    title,
    body,
    action,
}: {
    title: string;
    body: string;
    action: React.ReactNode;
}) {
    return (
        <div className={`${cardClass} text-center`}>
            <div className='mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-danger-subtle'>
                <HugeiconsIcon
                    icon={AlertCircleIcon}
                    className='size-6 text-danger-fg'
                    strokeWidth={1.75}
                />
            </div>
            <h1 className='m-0 font-heading text-lg font-medium text-content'>
                {title}
            </h1>
            <p className='mx-auto mt-2 max-w-80 text-sm text-content-muted'>
                {body}
            </p>
            <div className='mt-6'>{action}</div>
        </div>
    );
}

/**
 * A card-shaped placeholder, for the instant a `<Suspense>` boundary waits on
 * a query param.
 *
 * It exists because the obvious fallback is wrong: passing the real card as its
 * own fallback puts a `useSearchParams()` read inside the boundary's fallback,
 * which under `cacheComponents: true` fails the build with "Uncached data was
 * accessed outside of <Suspense>". A fallback has to be static.
 */
export function AuthCardSkeleton() {
    return (
        <div className={`${cardClass} animate-pulse`} aria-hidden>
            <div className='mb-2 h-6 w-2/3 rounded-md bg-line/70' />
            <div className='mb-6 h-4 w-11/12 rounded-md bg-line/50' />
            <div className='mb-4 h-11 w-full rounded-md bg-line/50' />
            <div className='h-11 w-full rounded-md bg-line/70' />
        </div>
    );
}
