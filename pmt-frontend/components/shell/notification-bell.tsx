'use client';

import { Notification01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useState } from 'react';

import { NotificationRow } from '@/components/shell/notification-row';
import { HeaderIconButton } from '@/components/shell/header-icon-button';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTitle,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    useMarkAllNotificationsRead,
    useMarkNotificationRead,
    useNotifications,
    useUnreadNotificationCount,
} from '@/hooks/notifications/use-notifications';

/**
 * The header bell.
 *
 * Two queries, deliberately split. The COUNT is polled in the background; the
 * LIST is not requested until the popover opens. A dashboard left open on a
 * second monitor all day therefore costs one indexed aggregate a minute rather
 * than a page of rows per navigation.
 *
 * This panel answers "what needs me now", so it shows the first page and stops.
 * The full history is the activity sheet, which is what the footer opens: two
 * surfaces over one endpoint, split by depth rather than by dataset, because
 * there is only one personal feed on this API.
 */

/** Enough rows to fill the panel without making it a scroll marathon. */
const PAGE_SIZE = 10;

type Tab = 'unread' | 'all';

export function NotificationBell({
    /** Opens the activity sheet. The popover closes itself first. */
    onOpenActivity,
}: {
    onOpenActivity: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<Tab>('unread');

    const { data: summary } = useUnreadNotificationCount();
    const unread = summary?.count ?? 0;

    // The tab IS the query. `unreadOnly` is a param the backend applies before
    // paginating, so neither tab ever filters rows in the browser (D4).
    const { data, isLoading, isError, error } = useNotifications(
        { pageSize: PAGE_SIZE, unreadOnly: tab === 'unread' },
        open,
    );

    const { mutate: markRead } = useMarkNotificationRead();
    const { mutate: markAllRead, isPending: markingAll } =
        useMarkAllNotificationsRead();

    const items = data?.items ?? [];

    const body = isLoading ? (
        <div className='space-y-2 p-4'>
            {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className='h-14 w-full' />
            ))}
        </div>
    ) : isError ? (
        // `ApiError.message` is written to be shown verbatim, so it is.
        <p className='px-4 py-8 text-center text-xs text-content-muted'>
            {error.message}
        </p>
    ) : items.length === 0 ? (
        <p className='px-4 py-8 text-center text-xs text-content-muted'>
            {tab === 'unread'
                ? 'Nothing unread.'
                : 'No notifications yet.'}
        </p>
    ) : (
        <ul className='max-h-96 overflow-y-auto'>
            {items.map((item) => (
                <NotificationRow
                    key={item.id}
                    item={item}
                    onMarkRead={markRead}
                />
            ))}
        </ul>
    );

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <HeaderIconButton
                    icon={Notification01Icon}
                    label={
                        unread > 0
                            ? `Notifications, ${unread} unread`
                            : 'Notifications'
                    }
                    indicator={unread > 0}
                />
            </PopoverTrigger>

            <PopoverContent
                align='end'
                sideOffset={8}
                className='w-96 gap-0 overflow-hidden p-0'>
                <div className='flex items-center justify-between px-4 pt-4 pb-3'>
                    <PopoverTitle className='text-content-muted'>
                        Notifications
                    </PopoverTitle>
                    {unread > 0 && (
                        <span className='rounded-full bg-surface-inset px-2 py-0.5 text-2xs font-medium tabular-nums text-content-muted'>
                            {unread > 99 ? '99+' : unread} new
                        </span>
                    )}
                </div>

                <Tabs
                    value={tab}
                    onValueChange={(value) => setTab(value as Tab)}
                    className='gap-0'>
                    <div className='flex items-center justify-between gap-2 border-b border-line-subtle px-2'>
                        <TabsList variant='line'>
                            <TabsTrigger value='unread'>Unread</TabsTrigger>
                            <TabsTrigger value='all'>All</TabsTrigger>
                        </TabsList>
                        {/* Only offered when there is something to act on: a
                            permanently visible "Mark all read" on an empty
                            inbox is a button that cannot do anything. */}
                        {unread > 0 && (
                            <Button
                                variant='ghost'
                                size='sm'
                                disabled={markingAll}
                                onClick={() => markAllRead()}
                                className='h-auto cursor-pointer py-1 text-xs text-content-muted'>
                                <HugeiconsIcon icon={Tick02Icon} />
                                Mark all read
                            </Button>
                        )}
                    </div>

                    {/* Both tabs render the same list, because the same single
                        query serves both and its params are the tab. Radix
                        mounts only the active one. */}
                    <TabsContent value='unread'>{body}</TabsContent>
                    <TabsContent value='all'>{body}</TabsContent>
                </Tabs>

                <div className='border-t border-line-subtle p-2'>
                    <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => {
                            setOpen(false);
                            onOpenActivity();
                        }}
                        className='w-full cursor-pointer text-xs text-content-muted'>
                        Open activity
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
