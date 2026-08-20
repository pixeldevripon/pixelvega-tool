'use client';

import { ArrowDown01Icon, ArrowUp01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { toneToVariant } from '@/components/common/enum-badge';
import type { StatusVariant } from '@/components/common/status-badge';
import type { EnumDisplay } from '@/contexts/role-context';
import { cn } from '@/lib/utils';

/**
 * "How this figure moved", as one chip.
 *
 * Every part of it is a decision the server already made. The percentage is
 * `changeLabel`, and whether the movement reads as good or bad is `tone`: more
 * hours logged going up is neutral, more overdue projects going up is bad, and
 * that is a judgment about the business rather than a styling choice (ADR 0001).
 *
 * The ARROW is the one thing decided here, from the sign of `changeRate`, and it
 * is not the same question as the tone. A fall in overdue projects points down
 * and reads as success, so tying the arrow to the colour would draw an up arrow
 * on a number that went down.
 *
 * `tone.label` is the accessible name. Colour alone never carries the meaning.
 */

const SURFACE: Record<StatusVariant, string> = {
    neutral: 'bg-surface-inset text-content-muted',
    info: 'bg-primary-subtle text-primary-subtle-content',
    success: 'bg-success-subtle text-success-fg',
    warning: 'bg-warning-subtle text-warning-fg',
    danger: 'bg-danger-subtle text-danger-fg',
};

export function DeltaPill({
    /** Null when there was no comparable previous window. Renders nothing. */
    changeLabel,
    changeRate,
    tone,
    className,
}: {
    changeLabel: string | null;
    changeRate: number | null;
    tone: EnumDisplay;
    className?: string;
}) {
    if (!changeLabel) return null;

    const rose = (changeRate ?? 0) > 0;

    return (
        <span
            title={tone.label}
            className={cn(
                'inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-2xs font-medium tabular-nums',
                SURFACE[toneToVariant(tone.tone)],
                className,
            )}>
            <HugeiconsIcon
                aria-hidden
                icon={rose ? ArrowUp01Icon : ArrowDown01Icon}
                className='size-3'
                strokeWidth={2.25}
            />
            {changeLabel}
            <span className='sr-only'>{tone.label}</span>
        </span>
    );
}
