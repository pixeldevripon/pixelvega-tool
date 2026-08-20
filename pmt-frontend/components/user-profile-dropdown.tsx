'use client';

import { Logout01Icon, UserAccountIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';

import { toneToVariant } from '@/components/common/enum-badge';
import { statusDot } from '@/components/common/status-badge';
import {
    Avatar,
    AvatarBadge,
    AvatarFallback,
    AvatarImage,
} from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { EnumDisplay } from '@/contexts/role-context';
import { signOut } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

/** What the shell knows about the signed-in person. All of it comes from the session. */
export interface HeaderUser {
    name?: string;
    email?: string;
    /** For display only. Gate on permissions, never on this. */
    role?: EnumDisplay;
    /** Drives the presence dot's colour, at the tone the API decided. */
    status?: EnumDisplay;
    image?: string | null;
}

/**
 * The account menu.
 *
 * The trigger is the avatar and nothing else: no chevron. In a row of four
 * controls the chevron was the only glyph that was not an icon, and an avatar is
 * already the most recognisable "this is me, and it opens something" affordance
 * on the page.
 *
 * ── The presence dot is data, not decoration ──
 *
 * It is coloured from the session's `status` tone, so it says something true. A
 * hardcoded green dot is the same defect as a hardcoded capability flag: it
 * asserts a state nobody checked. In practice a suspended account never reaches
 * this component, because `app/(app)/layout.tsx` redirects it, so the dot is
 * normally the success tone. Normally is not always, and the difference is free.
 *
 * ── Why there is one link ──
 *
 * `/account` is the only authenticated route that exists today. The reference
 * screenshot has four items, and three of them would be links to 404s. They
 * arrive as their screens do.
 */
export default function ProfileDropdown({
    loggedInUser,
    className,
}: {
    loggedInUser: HeaderUser;
    className?: string;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const queryClient = useQueryClient();

    const name = loggedInUser.name?.trim() || 'Your account';
    const initial = (loggedInUser.name || loggedInUser.email || '?')
        .charAt(0)
        .toUpperCase();

    /**
     * Cmd+/ jumps to the profile, and the menu advertises it.
     *
     * The Cmd+H handler that used to live here is gone: on macOS that is Hide
     * Window, and preventing it to open the dashboard root in a NEW TAB took a
     * shortcut the operating system owns and did something else with it.
     */
    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (event.metaKey && event.key === '/') {
                event.preventDefault();
                if (!pathname.includes('/account')) router.push('/account');
            }
        },
        [pathname, router],
    );

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    async function handleSignOut() {
        await signOut({
            fetchOptions: {
                onSuccess: () => {
                    // Clear the cache BEFORE navigating. Leaving it would let
                    // the next person to sign in on this browser see the
                    // previous session's rows for a frame, from cache, before
                    // their own queries resolve.
                    queryClient.clear();
                    // One door, so there is nothing to choose. `replace`, not
                    // `push`: the signed-out app must not sit in history where
                    // Back returns to it.
                    router.replace('/login');
                    router.refresh();
                },
            },
        });
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type='button'
                    aria-label='Open the account menu'
                    className={cn(
                        'flex cursor-pointer items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        className,
                    )}>
                    <UserAvatar user={loggedInUser} initial={initial} />
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align='end' sideOffset={8} className='w-64'>
                <div className='flex items-center gap-3 px-3 py-2.5'>
                    <UserAvatar user={loggedInUser} initial={initial} />
                    <div className='min-w-0 flex-1'>
                        <p className='truncate text-sm font-medium text-content'>
                            {name}
                        </p>
                        {loggedInUser.email && (
                            <p className='truncate text-xs text-content-muted'>
                                {loggedInUser.email}
                            </p>
                        )}
                    </div>
                </div>

                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                        <Link href='/account'>
                            <HugeiconsIcon icon={UserAccountIcon} />
                            My account
                            <DropdownMenuShortcut>⌘ /</DropdownMenuShortcut>
                        </Link>
                    </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                    variant='destructive'
                    onSelect={() => void handleSignOut()}>
                    <HugeiconsIcon icon={Logout01Icon} />
                    Sign out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * The avatar, with the presence dot. Rendered twice, in the trigger and in the
 * menu's identity block, which is the whole reason it is a component: the two
 * have to be the same size and the same dot or the menu looks like it belongs to
 * someone else.
 */
function UserAvatar({
    user,
    initial,
}: {
    user: HeaderUser;
    initial: string;
}) {
    return (
        <Avatar size='lg' className='shrink-0'>
            {user.image && (
                <AvatarImage src={user.image} alt={user.name ?? 'Your avatar'} />
            )}
            <AvatarFallback className='bg-primary-subtle font-medium text-primary-subtle-content'>
                {initial}
            </AvatarFallback>
            {user.status && (
                <AvatarBadge
                    aria-hidden
                    title={user.status.label}
                    className={statusDot[toneToVariant(user.status.tone)]}
                />
            )}
        </Avatar>
    );
}
