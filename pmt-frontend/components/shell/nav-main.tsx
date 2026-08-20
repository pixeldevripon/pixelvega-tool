'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useNavPrefetch } from '@/components/shell/use-nav-prefetch';
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { useRole } from '@/contexts/role-context';
import type { NavGroup } from '@/lib/rbac-utils';
import { cn } from '@/lib/utils';

interface NavMainProps {
    groups: NavGroup[];
}

/**
 * The badge chip every NAV_BADGES entry renders. Unreferenced while that
 * registry is empty, and kept because it is the badge's agreed look: a new
 * badge should reuse it rather than restyle a second chip.
 */
export function CountChip({ count }: { count: number }) {
    if (count <= 0) return null;
    return (
        <span className='ml-auto rounded-full bg-primary-subtle px-1.5 text-2xs font-medium tabular-nums text-primary-subtle-content'>
            {count > 99 ? '99+' : count}
        </span>
    );
}

/**
 * Actionable count badges (04 section 1.4: badges only where a number demands
 * action). Keyed by nav url; each badge only mounts when its item survived
 * permission filtering, so a role never fires a query for a page it cannot see.
 *
 * **Empty until the modules that earn a badge land.** The reference's eight
 * entries counted its own domain and went with it. Two rules survive them and
 * are the reason this comment stays:
 *
 * 1. **ONE badge per row.** A queue badge counts OPEN WORK; a notification
 *    badge counts UNREAD. Put both on a row and they disagree the moment
 *    someone reads a notification without doing the work.
 * 2. **A badge's query params must match the target page's mount-time params
 *    exactly**, or the badge promises work the page does not show.
 *
 * PMT candidates, as their phases land: the PM's requirements inbox, the
 * internal review queue, pending leave requests, and open blockers.
 */
const NAV_BADGES: Record<string, React.ComponentType> = {};

/**
 * Grouped flat navigation (04 §1.2). Groups arrive already permission-filtered
 * (filterNavGroups) - an empty group never reaches this component.
 *
 * Active state is bg-sidebar-accent PLUS a 2px leading indicator (04 §1.4):
 * color is never the only cue.
 *
 * Premium shell (2026-07-17): groups stagger in on first mount (framer,
 * reduced-motion aware); labels use the micro-label style; tooltips carry
 * the labels in the collapsed icon rail.
 *
 * Nav `url`s are relative and root-less ('trips', '' for Overview), so the
 * href is built here. The dashboard serves at the root - concatenating a '/'
 * root would yield '//trips', which a browser reads as protocol-relative.
 */
const toHref = (url?: string) => (!url ? '/' : `/${url.replace(/^\/+/, '')}`);

export function NavMain({ groups }: NavMainProps) {
    const pathname = usePathname();
    const reduceMotion = useReducedMotion();
    // On mobile the sidebar is an overlay sheet - navigating must dismiss it,
    // or it keeps covering the page the user just navigated to. No-op on
    // desktop (openMobile is only rendered under the mobile breakpoint).
    const { setOpenMobile } = useSidebar();
    // Warms the destination table's query on hover/focus. The route itself is
    // already instant; this closes the remaining gap, which is the table's own
    // fetch-on-mount.
    const prefetchNav = useNavPrefetch();

    const normPath = pathname.replace(/\/+$/, '') || '/';
    const norm = (target: string) => target.replace(/\/+$/, '') || '/';

    // Overview ('/') matches only exactly; sections own their subtree so
    // /trips/abc/edit still lights Tours.
    const matches = (url?: string) => {
        const t = norm(toHref(url));
        if (t === '/') return normPath === '/';
        return normPath === t || normPath.startsWith(`${t}/`);
    };

    const isPathActive = (url?: string) => {
        if (!matches(url)) return false;
        // Deepest match wins. Owning your subtree is right until one nav target
        // sits INSIDE another - '/pages/new' is under '/pages' - and then both
        // rows light at once, which reads as a bug on a flat list of siblings.
        // No-op for every non-nested target, which is all of them bar that pair.
        const t = norm(toHref(url));
        return !groups.some((g) =>
            g.items.some((other) => {
                const o = norm(toHref(other.url));
                return o.length > t.length && matches(other.url);
            }),
        );
    };

    return (
        <>
            {groups.map((group, groupIndex) => (
                <motion.div
                    key={group.label ?? 'main'}
                    initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                        duration: 0.26,
                        delay: groupIndex * 0.06,
                        ease: [0.25, 1, 0.5, 1],
                    }}>
                    <SidebarGroup>
                        {group.label && (
                            <SidebarGroupLabel className='px-4 text-2xs font-medium tracking-caps uppercase text-sidebar-content/60 group-data-[collapsible=icon]:hidden'>
                                {group.label}
                            </SidebarGroupLabel>
                        )}
                        <SidebarGroupContent>
                            <SidebarMenu className='gap-0.5 px-2'>
                                {group.items.map(item => {
                                    const active = isPathActive(item.url);
                                    const DynamicBadge = item.url
                                        ? NAV_BADGES[item.url]
                                        : undefined;
                                    return (
                                        <SidebarMenuItem key={item.title}>
                                            <SidebarMenuButton
                                                asChild
                                                tooltip={item.title}
                                                isActive={active}
                                                className={cn(
                                                    'relative h-10 rounded-md transition-colors duration-fast',
                                                    active
                                                        ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                                                        : 'hover:bg-sidebar-accent/50'
                                                )}>
                                                <Link
                                                    href={toHref(item.url)}
                                                    onMouseEnter={() =>
                                                        prefetchNav(item.url)
                                                    }
                                                    onFocus={() =>
                                                        prefetchNav(item.url)
                                                    }
                                                    onClick={() =>
                                                        setOpenMobile(false)
                                                    }>
                                                    {/* 2px leading indicator - the non-color active cue */}
                                                    <span
                                                        aria-hidden
                                                        className={cn(
                                                            'absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full',
                                                            active
                                                                ? 'bg-primary'
                                                                : 'bg-transparent'
                                                        )}
                                                    />
                                                    {item.icon && (
                                                        <HugeiconsIcon
                                                            icon={item.icon}
                                                            className='size-5! shrink-0'
                                                        />
                                                    )}
                                                    <span className='text-sm'>
                                                        {item.title}
                                                    </span>
                                                    {item.badge != null ? (
                                                        <span className='ml-auto rounded-full bg-primary-subtle px-1.5 text-2xs font-medium tabular-nums text-primary-subtle-content'>
                                                            {item.badge}
                                                        </span>
                                                    ) : DynamicBadge ? (
                                                        <DynamicBadge />
                                                    ) : null}
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    );
                                })}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </motion.div>
            ))}
        </>
    );
}

