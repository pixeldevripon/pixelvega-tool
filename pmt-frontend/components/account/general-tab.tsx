'use client';

import type { ProfileOptions, UserProfile } from '@/types/profile';

import { ConnectedAccountsSection } from './connected-accounts-section';
import { DangerZoneSection } from './danger-zone-section';
import { EmailPasswordSection } from './email-password-section';
import { PersonalInformationSection } from './personal-information-section';
import { SocialUrlsSection } from './social-urls-section';

/**
 * The General tab: five blocks, in the reference's order.
 *
 * Each block owns its own form and its own Save, which is what the design shows
 * and also what the API wants: `PATCH /profiles/me` takes whatever subset it is
 * given, so a partial save is a normal request rather than a workaround. One
 * form across all five would make changing a phone number re-send a list of
 * social links.
 */
export function GeneralTab({
    user,
    options,
}: {
    user: UserProfile;
    options: ProfileOptions;
}) {
    return (
        <div>
            <PersonalInformationSection user={user} options={options} />
            <EmailPasswordSection user={user} policy={options.password} />
            <ConnectedAccountsSection user={user} />
            <SocialUrlsSection user={user} maxUrls={options.maxSocialUrls} />
            <DangerZoneSection user={user} />
        </div>
    );
}
