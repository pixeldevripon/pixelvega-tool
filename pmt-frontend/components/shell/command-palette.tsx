'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowTurnBackwardIcon, Calendar03Icon, Globe02Icon, MapsIcon, PlusSignIcon, Search01Icon } from '@hugeicons/core-free-icons';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from '@/components/ui/command';
import { Permission, ROLE_PERMISSIONS } from '@/lib/config/rbac';
import {
    navGroupsForRole,
    resolvePermissions,
} from '@/lib/rbac-utils';
import { getNavigations } from '@/navigations/navigations';
import type { EnumDisplay } from '@/contexts/role-context';

/**
 * Global command palette - Cmd+K (04 §1.4). Jump to any screen, any tour by
 * name, any booking by ref, any destination. "This is the real answer to
 * click depth - it makes the sidebar a map rather than the only road."
 *
 * Entity search is server-side (the same list endpoints the tables use, via
 * the domain hooks) and fires only while the dialog is open with 2+ typed
 * characters - the palette costs nothing while closed. Everything shown is
 * permission-gated with the exact same filter as the sidebar.
 */

const toHref = (url?: string) => (!url ? '/' : `/${url.replace(/^\/+/, '')}`);

function useDebounced<T>(value: T, ms: number): T {
    const [debounced, setDebounced] = React.useState(value);
    React.useEffect(() => {
        const t = setTimeout(() => setDebounced(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return debounced;
}

export function CommandPalette({
    userRole,
    userPermissions,
}: {
    userRole?: EnumDisplay;
    userPermissions?: string[];
}) {
    const router = useRouter();
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const debouncedQuery = useDebounced(query.trim(), 250);

    // Same resolution as the sidebar: effective backend grants first, static
    // role map only as a fallback. Using the role map unconditionally showed
    // staff palette entries their seat does not actually grant.
    const permissions = React.useMemo(
        () =>
            resolvePermissions(
                userRole?.value,
                userPermissions,
                ROLE_PERMISSIONS as Record<string, string[]>,
            ),
        [userRole, userPermissions],
    );
    const can = React.useCallback(
        (p: string) => permissions.includes(p),
        [permissions],
    );

    // Same resolver the sidebar uses, so the two can never disagree.
    const navGroups = React.useMemo(
        () => navGroupsForRole(getNavigations(), permissions),
        [permissions],
    );

    // ⌘K / Ctrl+K
    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((o) => !o);
            }
        };
        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    /**
     * Entity search. Each block is one `use<Entity>` call gated on BOTH `searching`
     * and the permission that page needs, so a role never fires a query for
     * something it cannot open.
     *
     * **Empty until the PMT modules land.** The reference searched tours,
     * bookings and destinations; those went with its domain. Three rules
     * survive them, which is why this comment is here rather than the code
     * simply being gone:
     *
     * 1. **Gate on the permission**, not the role. `can(Permission.X)` where X
     *    is what the destination route needs.
     * 2. **Only search while open and with at least two characters.** That is
     *    what `searching` means. A palette that queries on mount costs a
     *    request per keystroke for nothing.
     * 3. **A list with no search param is fetched once per open** and filtered
     *    by cmdk client-side. A list with one passes `debouncedQuery` through.
     *    Never filter a searchable list in the browser.
     *
     * PMT candidates, as their phases land: projects, users, and blockers.
     */
    const searching = open && debouncedQuery.length >= 2;

    const go = (href: string) => {
        setOpen(false);
        setQuery('');
        router.push(href);
    };

    return (
        <>
            <button
                type='button'
                onClick={() => setOpen(true)}
                aria-label='Search (Command+K)'
                className='inline-flex h-9 items-center gap-2 rounded-md border border-input bg-surface px-3 text-sm text-muted-foreground transition-colors hover:bg-muted md:w-64 lg:w-96'>
                <HugeiconsIcon icon={Search01Icon} className='size-3.5 shrink-0' />
                <span className='hidden md:inline'>Search…</span>
                {/* <kbd className='ml-auto hidden rounded border border-line bg-surface-inset px-1 text-2xs font-medium text-content-subtle md:inline'>
                    ⌘K
                </kbd> */}
            </button>

            <CommandDialog
                open={open}
                onOpenChange={(o) => {
                    setOpen(o);
                    if (!o) setQuery('');
                }}
                title='Search the dashboard'
                description='Jump to a page, tour, booking or destination'
                className='w-[calc(100vw-2rem)] max-w-2xl sm:max-w-2xl'>
                <Command>
                    <CommandInput
                        placeholder='Search pages…'
                        value={query}
                        onValueChange={setQuery}
                        className='h-12 text-base'
                    />
                    <CommandList>
                        <CommandEmpty>No results.</CommandEmpty>

                        {navGroups.map((group) => (
                            <CommandGroup
                                key={group.label ?? 'nav'}
                                heading={group.label}>
                                {group.items.map((item) => (
                                    <CommandItem
                                        key={item.title}
                                        value={`${group.label} ${item.title}`}
                                        onSelect={() => go(toHref(item.url))}>
                                        {item.icon && (
                                            <HugeiconsIcon
                                                icon={item.icon}
                                                className='size-4'
                                            />
                                        )}
                                        {item.title}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ))}

                        {/* Quick actions and entity result groups go here as each
                            module lands, following the three rules above. The
                            reference's Tours / Bookings / Destinations groups are the
                            shape to copy: a CommandSeparator, then a CommandGroup with
                            a heading, then one CommandItem per row whose `value` folds
                            in the search term so cmdk scores it. */}
                    </CommandList>
                </Command>
            </CommandDialog>
        </>
    );
}
