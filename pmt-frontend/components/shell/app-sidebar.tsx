'use client';

import * as React from 'react';
import { useMemo } from 'react';

import Image from 'next/image';
import Link from 'next/link';

import {
    Sidebar,
    SidebarContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { ROLE_PERMISSIONS } from '@/lib/config/rbac';
import { navGroupsForRole, resolvePermissions } from '@/lib/rbac-utils';
import { getNavigations } from '@/navigations/navigations';
import { NavMain } from './nav-main';
import type { EnumDisplay } from '@/contexts/role-context';
import { COMPANY_NAME } from '@/lib/constants/product';

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
    userRole?: EnumDisplay;
    /** Effective permission set from the backend (staff/team grants included). */
    userPermissions?: string[];
    userName?: string;
    userImage?: string | null;
}

/**
 * Premium shell sidebar (task 2026-07-17): the rail reads as a WORKSPACE, not
 * a menu - brand header, frequency-grouped nav (permission-filtered), and an
 * identity footer that opens the profile. Collapses to a 56px icon rail
 * (tooltips take over labels; the wordmark and footer text hide).
 */
export function AppSidebar({
    userRole,
    userPermissions,
    userName,
    userImage,
    ...props
}: AppSidebarProps) {
    const navData = getNavigations();
    // Mobile: the sidebar is an overlay sheet - navigating via the logo must
    // dismiss it just like the NavMain links do. No-op on desktop.
    const { setOpenMobile } = useSidebar();
    const filteredNav = useMemo(() => {
        const permissions = resolvePermissions(
            userRole?.value,
            userPermissions,
            ROLE_PERMISSIONS as Record<string, string[]>
        );
        // Shared with the command palette so the two cannot drift.
        return navGroupsForRole(navData, permissions);
    }, [userRole, userPermissions, navData]);

    return (
        <Sidebar collapsible='icon' {...props}>
            <SidebarHeader className='px-3 pt-3'>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <Link
                            href='/'
                            onClick={() => setOpenMobile(false)}
                            className='flex items-center gap-2.5 rounded-md px-1.5 py-1 transition-colors duration-fast'>
                            {/* Two files rather than one recoloured by CSS:
                                `next/image` renders an <img>, which cannot
                                inherit `currentColor`. The wordmark is 181x24,
                                so the intrinsic size is passed truthfully and
                                the height is constrained in CSS. */}
                            <Image
                                src='/logo/pixelvega-light.svg'
                                alt={COMPANY_NAME}
                                width={181}
                                height={24}
                                priority
                                className='h-4 w-auto shrink-0 object-contain dark:hidden'
                            />
                            <Image
                                src='/logo/pixelvega-dark.svg'
                                alt={COMPANY_NAME}
                                width={181}
                                height={24}
                                priority
                                className='hidden h-4 w-auto shrink-0 object-contain dark:block'
                            />
                        </Link>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain groups={filteredNav} />
            </SidebarContent>
        </Sidebar>
    );
}

