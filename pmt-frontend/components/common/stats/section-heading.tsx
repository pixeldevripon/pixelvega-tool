import { toneToVariant } from '@/components/common/enum-badge';
import { statusDot } from '@/components/common/status-badge';
import { cn } from '@/lib/utils';

/**
 * A section heading: a tone dot, a title, a count chip, and an optional action.
 *
 * The board-column heading from the reference, used for every group on the
 * overview so a reader gets one heading shape rather than six. The dot reads its
 * colour from the same tone map as every badge, and the count sits in a chip so
 * "Projects 12" cannot be misread as "Projects 12" the project name.
 */
export function SectionHeading({
    title,
    count,
    tone = 'default',
    action,
    className,
}: {
    title: string;
    /** Omitted when the group has no meaningful size. */
    count?: number | string;
    tone?: string;
    action?: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('flex items-center gap-2', className)}>
            <span
                aria-hidden
                className={cn(
                    'size-2 shrink-0 rounded-full',
                    statusDot[toneToVariant(tone)],
                )}
            />
            <h2 className='font-heading text-sm font-medium text-content'>
                {title}
            </h2>
            {count !== undefined && (
                <span className='rounded-full bg-surface-inset px-1.5 py-0.5 text-2xs font-medium tabular-nums text-content-muted'>
                    {count}
                </span>
            )}
            {action && <div className='ml-auto'>{action}</div>}
        </div>
    );
}
