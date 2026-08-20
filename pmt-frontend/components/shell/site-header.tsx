import { CommandPalette } from '@/components/shell/command-palette';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import ProfileDropdown from '@/components/user-profile-dropdown';
import type { EnumDisplay } from '@/contexts/role-context';
import { PRODUCT_NAME } from '@/lib/constants/product';

interface SiteHeaderProps {
    userName?: string;
    userEmail?: string;
    userRole?: EnumDisplay;
    userPermissions?: string[];
    userImage?: string | null;
}

export function SiteHeader({
    userName,
    userEmail,
    userRole,
    userPermissions,
    userImage,
}: SiteHeaderProps) {
    return (
        <header className='flex h-(--header-height) bg-surface-raised shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) shadow-none border-b border-border/50 md:rounded-t-2xl'>
            <div className='flex flex-1 items-center justify-between gap-1 px-4 lg:gap-2 lg:px-6'>
                <div className='flex items-center gap-2'>
                    {/* Mobile-only: the sidebar is an overlay sheet there and this is the
              only way to open it. On desktop the rail is always visible. */}
                    <SidebarTrigger className='-ml-1 md:hidden' />
                    <Separator
                        orientation='vertical'
                        className='mx-2 data-[orientation=vertical]:h-4 md:hidden'
                    />
                    {/* The product name, not a greeting. A fixed "Welcome to X"
                        is wasted header space on a tool people open twenty
                        times a day, and it competes with the page's own <h1>
                        for the same role. */}
                    <span className='font-sans text-base font-medium text-content'>
                        {PRODUCT_NAME}
                    </span>
                </div>
                <div className='flex items-center gap-2 md:gap-4'>
                    <CommandPalette
                        userRole={userRole}
                        userPermissions={userPermissions}
                    />

                    {/* PMT's notification bell lands here in D8, against
                        GET /notifications and /notifications/unread-count. The
                        reference's version is kept as the pattern in
                        reference-notes/design-source/notification-bell.tsx. */}
                    <ProfileDropdown
                        loggedInUser={{
                            name: userName,
                            email: userEmail,
                            role: userRole,
                            image: userImage,
                        }}
                    />
                </div>
            </div>
        </header>
    );
}
