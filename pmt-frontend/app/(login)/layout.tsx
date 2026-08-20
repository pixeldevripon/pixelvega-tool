import Image from 'next/image';

import { COMPANY_NAME, PRODUCT_NAME } from '@/lib/constants/product';

/**
 * The shell every signed-out screen sits in: sign in, forgot password, set
 * password, reset password.
 *
 * ── One door ──
 *
 * All six roles sign in here. A CLIENT and a SYSTEM_ADMIN use the same URL, and
 * what they see afterwards is decided by `GET /users/me/permissions`. A second
 * door per audience would be a second place for the redirect rules to disagree
 * with each other, and it would leak which audience an email belongs to before
 * anyone has authenticated.
 *
 * ── Why a single centred column and not a split-screen brand panel ──
 *
 * This is an internal tool. Everyone who reaches this screen already works
 * here, already knows what the product is, and is trying to get past this page
 * as fast as possible. A marketing panel sells to nobody and costs half the
 * viewport. So the door is one column: the wordmark, the product name, the
 * form, nothing else.
 *
 * A Server Component, deliberately. Nothing here needs state, so the shell is
 * static HTML and only the card inside it is interactive.
 */
export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className='flex min-h-screen flex-col items-center justify-center bg-surface px-6 py-12'>
            <div className='mb-8 flex flex-col items-center'>
                {/* Two files rather than one recoloured by CSS: `next/image`
                    renders an <img>, which cannot inherit `currentColor`. */}
                <Image
                    src='/logo/pixelvega-light.svg'
                    alt={COMPANY_NAME}
                    width={181}
                    height={24}
                    priority
                    className='h-5 w-auto object-contain dark:hidden'
                />
                <Image
                    src='/logo/pixelvega-dark.svg'
                    alt={COMPANY_NAME}
                    width={181}
                    height={24}
                    priority
                    className='hidden h-5 w-auto object-contain dark:block'
                />
                <span className='mt-2.5 text-2xs font-medium uppercase tracking-caps text-content-subtle'>
                    {PRODUCT_NAME}
                </span>
            </div>

            <div className='w-full max-w-100'>{children}</div>

            <p className='mt-6 w-full max-w-100 text-center text-xs text-content-subtle'>
                We will never ask for your password or a code by email, chat or
                phone.
            </p>
        </div>
    );
}
