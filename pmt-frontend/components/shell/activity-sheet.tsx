'use client';

import { Tick02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { NotificationRow } from '@/components/shell/notification-row';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetBody,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
    useMarkAllNotificationsRead,
    useMarkNotificationRead,
    useNotificationFeed,
    useUnreadNotificationCount,
} from '@/hooks/notifications/use-notifications';

/**
 * The activity panel: the full personal feed, newest first, as deep as you care
 * to scroll.
 *
 * Same endpoint as the bell and the same row, different question. The bell
 * answers "what needs me now" and stops at one page; this answers "what has
 * happened" and pages through the lot. Splitting them by depth rather than by
 * dataset is a decision forced by the API: there is no per user activity
 * endpoint, and `ProjectActivity` has no controller to read one from. The
 * reasoning is written down in `docs/dashboard/03-header-chrome.md`, so that if
 * a real activity feed lands later, this is the only file that moves.
 *
 * ── No day headings ──
 *
 * The obvious flourish here is "Today" / "Yesterday" dividers. It is also
 * grouping, in a browser, which D4 puts on the server. The rows carry a
 * relative timestamp each instead, which is what the reference panel does too.
 */

const PAGE_SIZE = 20;

export function ActivitySheet({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { data: summary } = useUnreadNotificationCount();
    const unread = summary?.count ?? 0;

    const {
        data,
        isLoading,
        isError,
        error,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useNotificationFeed({ pageSize: PAGE_SIZE }, open);

    const { mutate: markRead } = useMarkNotificationRead();
    const { mutate: markAllRead, isPending: markingAll } =
        useMarkAllNotificationsRead();

    // Concatenating the loaded pages, which is what the paged cache holds. Not a
    // derivation: the order, the contents and the page size are all the API's.
    const items = data?.pages.flatMap((page) => page.items) ?? [];

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side='right'
                className='w-full gap-0 sm:max-w-md'>
                {/* pr-16 clears the sheet's own close button, which is a 36px
                    square pinned 16px from the right and would otherwise sit
                    under the action. */}
                <SheetHeader className='flex-row items-center justify-between gap-2 border-b border-line-subtle p-4 pr-16'>
                    <SheetTitle>Activity</SheetTitle>
                    <SheetDescription className='sr-only'>
                        Everything that has happened on your projects, newest
                        first.
                    </SheetDescription>
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
                </SheetHeader>

                {/* px-0: the rows are full bleed, separated by hairlines, so the
                    sheet's usual 8-unit inset would leave the dividers floating. */}
                <SheetBody className='px-0'>
                    {isLoading ? (
                        <div className='space-y-2 p-4'>
                            {Array.from({ length: 6 }).map((_, index) => (
                                <Skeleton key={index} className='h-16 w-full' />
                            ))}
                        </div>
                    ) : isError ? (
                        <p className='px-4 py-8 text-center text-xs text-content-muted'>
                            {error.message}
                        </p>
                    ) : items.length === 0 ? (
                        <p className='px-4 py-8 text-center text-xs text-content-muted'>
                            Nothing here yet. Assignments, blockers, deadlines
                            and approvals all show up in this panel.
                        </p>
                    ) : (
                        <ul>
                            {items.map((item) => (
                                <NotificationRow
                                    key={item.id}
                                    item={item}
                                    onMarkRead={markRead}
                                />
                            ))}
                        </ul>
                    )}
                </SheetBody>

                {hasNextPage && (
                    <SheetFooter className='border-t border-line-subtle p-4'>
                        <Button
                            variant='outline'
                            size='sm'
                            disabled={isFetchingNextPage}
                            onClick={() => void fetchNextPage()}
                            className='cursor-pointer'>
                            {isFetchingNextPage ? 'Loading' : 'Load more'}
                        </Button>
                    </SheetFooter>
                )}
            </SheetContent>
        </Sheet>
    );
}
