import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { getAppSession } from '@/lib/server/app-session';

/**
 * The landing route for every role.
 *
 * **Placeholder, deliberately.** Phase D3 replaces the body with the four real
 * dashboards, fed by `GET /dashboard`, which returns an `audience`
 * discriminator plus exactly one populated block. Nothing here computes a
 * number, and nothing here shows one: the previous product's Overview shipped
 * hardcoded figures ("Open projects" always said 8), and an honest empty state
 * is better than a confident wrong one.
 *
 * The permission redirect the reference had at this point is gone on purpose.
 * There, Overview WAS the analytics page, so a seat without `VIEW_ANALYTICS`
 * landed on a screen its own sidebar hid. Here every role holds
 * `VIEW_OWN_PROJECTS` and every role gets a dashboard, so there is nobody to
 * route away.
 */
export default async function DashboardPage() {
    const cookie = (await headers()).get('cookie') ?? '';
    const session = await getAppSession(cookie);

    if (!session) {
        redirect('/login');
    }

    return (
        <div className='flex flex-1 flex-col gap-4'>
            <div>
                <h1 className='text-2xl font-medium'>Overview</h1>
                <p className='mt-1 text-sm text-content-muted'>
                    Where your projects stand today
                </p>
            </div>

            <div className='rounded-lg border border-line bg-surface-raised px-6 py-8'>
                <p className='text-sm text-content-muted'>
                    The dashboard is being built against the API rather than
                    filled with placeholder figures. Use the sidebar to reach
                    your projects in the meantime.
                </p>
            </div>
        </div>
    );
}
