'use client';

import { Notification01Icon } from '@hugeicons/core-free-icons';

import { toneToVariant } from '@/components/common/enum-badge';
import { IconTile } from '@/components/common/icon-tile';
import { relativeTime } from '@/lib/relative-time';
import { cn } from '@/lib/utils';
import type { NotificationItem } from '@/types/notifications';

/**
 * One notification, shared by the bell's popover and the activity sheet.
 *
 * The two panels differ in density and in how much history they show, never in
 * what a row looks like, so there is one row component. A second one would be
 * the place the unread treatment silently diverges.
 *
 * ── Why one icon rather than one per type ──
 *
 * The reference screenshot puts the actor's photograph here. PMT's notification
 * payload has no actor, so there is nothing to photograph. The obvious
 * substitute, an icon per `NotificationType`, is a label map in the browser by
 * another name (D4), and this codebase deleted a 614 line one. So every row
 * carries the same icon and the API's `tone` colours it, while `type.label` in
 * the meta line says which kind it is. That keeps every judgment on the server.
 */
export function NotificationRow({
    item,
    onMarkRead,
    className,
}: {
    item: NotificationItem;
    /** Called with this row's id. Only wired up while the row is unread. */
    onMarkRead: (notificationId: string) => void;
    className?: string;
}) {
    const unread = item.readAt === null;

    const body = (
        <>
            <IconTile
                icon={Notification01Icon}
                variant={toneToVariant(item.type.tone)}
                className='rounded-full'
            />
            <span className='min-w-0 flex-1 text-left'>
                <span className='block text-sm font-medium text-content'>
                    {item.title}
                </span>
                {item.message && (
                    <span className='mt-0.5 line-clamp-2 block text-xs text-content-muted'>
                        {item.message}
                    </span>
                )}
                {/* Each part is its own element rather than three text nodes in
                    one: the timestamp and the type are separate facts, and a
                    single node makes both unaddressable to a test and to a
                    screen reader's element-by-element navigation. */}
                <span className='mt-1 flex items-center gap-1.5 text-2xs text-content-subtle'>
                    <span>{relativeTime(item.createdAt)}</span>
                    <span aria-hidden>·</span>
                    <span>{item.type.label}</span>
                </span>
            </span>
            {/* Unread is a dot rather than a colour on the title: the title has
                to stay equally readable in both states. It sits where the
                reference put its dismiss control, which PMT has no route for. */}
            <span
                aria-hidden
                className={cn(
                    'mt-1.5 size-2 shrink-0 rounded-full',
                    unread ? 'bg-primary' : 'bg-transparent',
                )}
            />
        </>
    );

    const shell = cn(
        'flex w-full items-start gap-3 px-4 py-3 transition-colors duration-fast',
        unread && 'bg-primary-subtle/40',
        className,
    );

    // A read row has nothing left to do, so it is not a control. Rendering it as
    // a button anyway would put a focus stop on every row of a long history and
    // promise an action that does not happen.
    if (!unread) {
        return (
            <li className='border-b border-line-subtle last:border-b-0'>
                <div className={shell}>{body}</div>
            </li>
        );
    }

    return (
        <li className='border-b border-line-subtle last:border-b-0'>
            <button
                type='button'
                aria-label={`Mark as read: ${item.title}`}
                onClick={() => onMarkRead(item.id)}
                className={cn(
                    shell,
                    'cursor-pointer hover:bg-primary-subtle/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                )}>
                {body}
            </button>
        </li>
    );
}
