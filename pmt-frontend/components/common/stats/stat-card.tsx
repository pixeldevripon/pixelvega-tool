'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
    ArrowDown01Icon,
    ArrowUp01Icon,
} from '@hugeicons/core-free-icons';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { DashboardMetric } from '@/types/dashboard';

/**
 * A headline tile: a label, a figure, and how it moved.
 *
 * Every part of it arrives decided. The delta, its sign, and whether the
 * movement reads as good or bad are all fields on the response, because
 * "is up good" is a judgment about the business rather than a styling choice.
 * This component's whole job is turning a tone name into a class.
 */

const TONE_CLASS: Record<string, string> = {
    default: 'bg-surface-inset text-content-muted',
    primary: 'bg-primary-subtle text-primary-subtle-content',
    success: 'bg-success-subtle text-success-fg',
    warning: 'bg-warning-subtle text-warning-fg',
    danger: 'bg-danger-subtle text-danger-fg',
};

export function StatCard({
    metric,
    children,
}: {
    metric: DashboardMetric;
    /** An optional sparkline or bar strip, rendered under the figure. */
    children?: React.ReactNode;
}) {
    const rose = (metric.changeRate ?? 0) > 0;

    return (
        <Card className='flex flex-col gap-3 p-4'>
            <div className='flex items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='truncate text-sm font-medium text-content'>
                        {metric.label}
                    </p>
                    {metric.caption && (
                        <p className='mt-0.5 truncate text-xs text-content-subtle'>
                            {metric.caption}
                        </p>
                    )}
                </div>

                {metric.changeLabel && (
                    <span
                        className={cn(
                            'flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium',
                            TONE_CLASS[metric.tone.tone] ?? TONE_CLASS.default,
                        )}
                        // The tone carries meaning colour alone cannot, so the
                        // server's word for it is the accessible name.
                        title={metric.tone.label}>
                        <HugeiconsIcon
                            icon={rose ? ArrowUp01Icon : ArrowDown01Icon}
                            className='size-3'
                            strokeWidth={2}
                        />
                        {metric.changeLabel}
                    </span>
                )}
            </div>

            <p className='text-2xl font-medium tabular-nums text-content'>
                {metric.valueLabel}
            </p>

            {children}
        </Card>
    );
}
