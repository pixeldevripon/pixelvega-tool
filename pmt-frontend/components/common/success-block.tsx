/**
 * The "it worked, check your inbox" panel.
 *
 * Lives in `common/` because BOTH the login doors and the profile's change-email
 * dialog show it, and `components/account/` may not import another module's
 * folder (D3). It was in `components/login/login-ui.tsx` until that import
 * became a dependency-direction error.
 */
import { Tick02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Link from 'next/link';

export function SuccessBlock({
    title,
    body,
    loginHref,
    loginLabel = 'Back to login',
}: {
    title: string;
    body: string;
    /** When provided, renders a "Back to login" link below the body. */
    loginHref?: string;
    loginLabel?: string;
}) {
    return (
        <div className='py-2 text-center'>
            {/* Bright green circle */}
            <div className='mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-success-subtle ring-4 ring-success-border/40'>
                <HugeiconsIcon
                    icon={Tick02Icon}
                    className='size-7 text-success-fg'
                    strokeWidth={2.5}
                />
            </div>
            <strong className='block text-base text-content'>{title}</strong>
            <p className='mt-2 text-sm leading-relaxed text-content-muted'>
                {body}
            </p>
            {loginHref && (
                <Link
                    href={loginHref}
                    className='mt-4 inline-flex items-center justify-center rounded-full border border-line bg-surface-overlay px-6 py-2.5 text-sm font-medium text-content transition-colors hover:border-primary hover:text-primary'>
                    {loginLabel}
                </Link>
            )}
        </div>
    );
}
