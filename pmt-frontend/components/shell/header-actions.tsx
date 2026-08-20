'use client';

import { Pulse01Icon } from '@hugeicons/core-free-icons';
import { useState } from 'react';

import { ActivitySheet } from '@/components/shell/activity-sheet';
import { HeaderIconButton } from '@/components/shell/header-icon-button';
import { NotificationBell } from '@/components/shell/notification-bell';
import { ThemeToggleButton } from '@/components/shell/theme-toggle-button';
import ProfileDropdown from '@/components/user-profile-dropdown';
import type { EnumDisplay } from '@/contexts/role-context';

/**
 * The header's right hand side: activity, notifications, theme, and the account
 * menu.
 *
 * This is the client boundary, and the only one the header gained. It exists
 * because exactly one piece of state is shared here, "is the activity sheet
 * open", and the bell's footer needs to set it. Holding it in `SiteHeader` would
 * make the whole header a client component for one boolean; holding it in the
 * bell would put the sheet inside a popover that unmounts when the popover
 * closes.
 */
export function HeaderActions({
    userName,
    userEmail,
    userRole,
    userStatus,
    userImage,
}: {
    userName?: string;
    userEmail?: string;
    userRole?: EnumDisplay;
    userStatus?: EnumDisplay;
    userImage?: string | null;
}) {
    const [activityOpen, setActivityOpen] = useState(false);

    return (
        <>
            {/* The bare pulse line, user's pick, matching the reference
                screenshot. It is the lightest of the three glyphs because an EKG
                stroke is wide and short where the other two fill a circle, so if
                the row ever needs evening out, this is the one to look at. */}
            <HeaderIconButton
                icon={Pulse01Icon}
                label='Activity'
                onClick={() => setActivityOpen(true)}
            />

            <NotificationBell onOpenActivity={() => setActivityOpen(true)} />

            <ThemeToggleButton />

            <ProfileDropdown
                loggedInUser={{
                    name: userName,
                    email: userEmail,
                    role: userRole,
                    status: userStatus,
                    image: userImage,
                }}
            />

            {/* Mounted here rather than inside the bell: a sheet rendered in a
                popover's subtree is torn down the moment the popover closes,
                which is precisely when the bell's footer opens it. */}
            <ActivitySheet
                open={activityOpen}
                onOpenChange={setActivityOpen}
            />
        </>
    );
}
