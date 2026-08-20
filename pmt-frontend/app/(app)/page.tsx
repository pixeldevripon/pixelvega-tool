import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { HomeView } from '@/components/home/home-view';
import { getAppSession } from '@/lib/server/app-session';

/**
 * The landing route for every role.
 *
 * A Server Component that checks the session and renders the view. It does not
 * fetch the dashboard: that is a client query, so the numbers can refetch on
 * focus and after a mutation without a full navigation.
 *
 * There is no per-role branching here. `GET /dashboard` answers with the block
 * the caller is entitled to, and `HomeView` switches on the `audience` field it
 * carries.
 */
export default async function OverviewPage() {
    const cookie = (await headers()).get('cookie') ?? '';
    const session = await getAppSession(cookie);

    if (!session) {
        redirect('/login');
    }

    return <HomeView />;
}
