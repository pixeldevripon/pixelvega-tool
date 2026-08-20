import type { IconSvgElement } from '@hugeicons/react';
import { HugeiconsIcon } from '@hugeicons/react';

import { toneToVariant } from '@/components/common/enum-badge';
import type { StatusVariant } from '@/components/common/status-badge';
import { cn } from '@/lib/utils';

/**
 * The rounded tinted square that leads a stat tile or a list row.
 *
 * Purely decorative, and `aria-hidden` for that reason: it repeats the meaning
 * of the label beside it, so a screen reader announcing it would read every row
 * twice. The tone it carries is already spelled out in words somewhere in the
 * same row, which is what keeps colour from being the sole carrier of meaning.
 *
 * It reads the same tone vocabulary as every badge on the screen. A card
 * inventing its own tinted surface is how two cards end up disagreeing about
 * what a warning looks like.
 */

const SURFACE: Record<StatusVariant, string> = {
    neutral: 'bg-surface-inset text-content-muted',
    info: 'bg-primary-subtle text-primary-subtle-content',
    success: 'bg-success-subtle text-success-fg',
    warning: 'bg-warning-subtle text-warning-fg',
    danger: 'bg-danger-subtle text-danger-fg',
};

const SIZE: Record<'sm' | 'md', { box: string; icon: string }> = {
    sm: { box: 'size-8 rounded-md', icon: 'size-4' },
    md: { box: 'size-10 rounded-lg', icon: 'size-5' },
};

export function IconTile({
    icon,
    /** The API's tone name. Anything unknown falls back to neutral. */
    tone = 'default',
    size = 'md',
    className,
}: {
    icon: IconSvgElement;
    tone?: string;
    size?: 'sm' | 'md';
    className?: string;
}) {
    return (
        <span
            aria-hidden
            className={cn(
                'inline-flex shrink-0 items-center justify-center',
                SIZE[size].box,
                SURFACE[toneToVariant(tone)],
                className,
            )}>
            <HugeiconsIcon
                icon={icon}
                className={SIZE[size].icon}
                strokeWidth={1.75}
            />
        </span>
    );
}
