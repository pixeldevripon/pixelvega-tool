'use client';

import { useRole } from '@/contexts/role-context';
import { signOut } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import {
    ArrowDown01Icon,
    ArrowRight01Icon,
    Moon02Icon,
    Sun03Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import UserAvatarImage from './avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface ProfileDropdownProps {
    loggedInUser: any;
    className?: string;
}

export default function ProfileDropdown({
    loggedInUser,
    className,
}: ProfileDropdownProps) {
    const router = useRouter();
    const pathname = usePathname();
    const queryClient = useQueryClient();

    // Global keyboard shortcuts (menu open/close + focus is handled by Radix)
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.metaKey && e.key.toLowerCase() === 'h') {
                e.preventDefault();
                window.open('/', '_blank');
            }
            if (e.metaKey && e.key === '/') {
                if (!pathname.includes('/profile')) {
                    router.push(`/profile`);
                }
            }
        },
        [pathname, router]
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
                    aria-label='Open account menu'
                    className={cn(
                        'group flex cursor-pointer items-center rounded-full outline-none',
                        className
                    )}>
                    <UserAvatarImage
                        user={loggedInUser}
                        isVerified={loggedInUser?.isVerified}
                    />
                    <HugeiconsIcon
                        size={16}
                        className='text-content-muted transition-transform duration-200 group-data-[state=open]:rotate-180'
                        icon={ArrowDown01Icon}
                    />
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align='end' sideOffset={8} className='w-64'>
                <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                        <Link href='/profile'>
                            Your profile
                            <HugeiconsIcon
                                icon={ArrowRight01Icon}
                                className='ml-auto text-muted-foreground'
                            />
                        </Link>
                    </DropdownMenuItem>

                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <div className='flex items-center justify-between px-3 py-1.5'>
                    <span className='text-xs font-medium text-muted-foreground'>
                        Theme
                    </span>
                    <ThemeSegmentedControl />
                </div>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                    variant='destructive'
                    onSelect={() => void handleSignOut()}>
                    Sign Out
                    <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        className='ml-auto'
                    />
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * Light and dark only - there is no "System" option.
 *
 * A first visit still FOLLOWS the operating system (the provider keeps
 * `defaultTheme='system'` + `enableSystem`), so dropping the button costs nothing
 * except the ability to pin yourself back to "whatever the OS says" after
 * choosing explicitly. What it buys is a control with two states instead of a
 * third that most people read as a bug ("why is neither light nor dark on?").
 */
const THEME_OPTIONS = [
    { value: 'light', label: 'Light theme', icon: Sun03Icon },
    { value: 'dark', label: 'Dark theme', icon: Moon02Icon },
] as const;

function ThemeSegmentedControl() {
    // `resolvedTheme`, NOT `theme`. `theme` is the STORED preference, which is
    // still `'system'` for anyone who picked that before the option went away -
    // and for everyone on their first visit, since that is the provider default.
    // Matching on it would leave both pills dark and the control looking broken.
    // `resolvedTheme` is what is actually painted, which is also the honest thing
    // to highlight: it answers "which one am I looking at right now".
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <div className='flex items-center gap-0.5 rounded-full bg-muted p-0.5'>
            {THEME_OPTIONS.map(option => {
                // Gated on `mounted`: the server cannot know the resolved theme,
                // so rendering an active pill before hydration would mismatch.
                const active = mounted && resolvedTheme === option.value;
                return (
                    <button
                        key={option.value}
                        type='button'
                        aria-label={option.label}
                        title={option.label}
                        onClick={() => setTheme(option.value)}
                        className={cn(
                            'flex size-6 cursor-pointer items-center justify-center rounded-full transition-colors',
                            active
                                ? 'bg-background text-foreground shadow-sm ring-1 ring-foreground/10'
                                : 'text-muted-foreground hover:text-foreground'
                        )}>
                        <HugeiconsIcon icon={option.icon} size={13} />
                    </button>
                );
            })}
        </div>
    );
}

