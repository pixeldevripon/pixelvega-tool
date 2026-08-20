'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

import { AccountSkeleton } from '@/components/skeletons/account-skeleton';
import {
    useProfileOptionsQuery,
    useProfileQuery,
} from '@/hooks/profile/use-profile';

import { AccountTabs, type AccountTab } from './account-tabs';
import { GeneralTab } from './general-tab';
import { SecurityTab } from './security-tab';

/**
 * The account screen.
 *
 * ── Which tabs exist ──
 *
 * The reference design shows seven. This product has content for two.
 * Workspace, Integrations and Billing & Usage describe entities that do not
 * exist here; Notifications has no preference model behind it; and Members
 * would be a second door to `/users`, which the sidebar already owns and
 * `navigations.ts` explicitly forbids duplicating. A tab that opens an empty
 * screen is a worse answer than a tab that is not there, so the rest are absent
 * rather than present and dead.
 *
 * ── Tabs are client state, not routes ──
 *
 * The page is small and both tabs read from the same two queries, so splitting
 * them into URLs would add a navigation to switch between two things already in
 * memory.
 *
 * ── Both queries are awaited before anything renders ──
 *
 * Deliberately, and it is the one place this screen accepts a slower first
 * paint. `options` carries the country list, the gender list and the password
 * policy, and every form field on the General tab needs it. Rendering the form
 * first would show selects with no options and a password checklist with no
 * rules, which is a worse half-second than a skeleton.
 */
export function AccountView() {
    const profile = useProfileQuery();
    const options = useProfileOptionsQuery();
    const [tab, setTab] = useState('general');

    const tabs: AccountTab[] = [
        { key: 'general', label: 'General' },
        { key: 'security', label: 'Security' },
    ];

    if (profile.isLoading || options.isLoading) {
        return <AccountSkeleton />;
    }

    if (!profile.data || !options.data) {
        return (
            <p className='text-sm text-danger-fg'>
                Your account could not be loaded. Try again in a moment.
            </p>
        );
    }

    return (
        <div className='w-full max-w-5xl pb-16'>
            <AccountTabs tabs={tabs} active={tab} onChange={setTab} />

            <motion.div
                // Keyed on the tab so the panel animates in on every switch
                // rather than only on first mount.
                key={tab}
                id={`account-panel-${tab}`}
                role='tabpanel'
                aria-labelledby={`account-tab-${tab}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className='pt-8'>
                {tab === 'general' ? (
                    <GeneralTab user={profile.data} options={options.data} />
                ) : (
                    <SecurityTab />
                )}
            </motion.div>
        </div>
    );
}
