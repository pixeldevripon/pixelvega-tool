'use client';

import {
    AlertCircleIcon,
    AlertDiamondIcon,
    Building03Icon,
    ChartLineData01Icon,
    Clock01Icon,
} from '@hugeicons/core-free-icons';
import type { IconSvgElement } from '@hugeicons/react';

import { DeltaPill } from '@/components/common/stats/delta-pill';
import { IconTile } from '@/components/common/stats/icon-tile';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { DashboardMetric } from '@/types/dashboard';

/**
 * A headline tile: an icon, a label, the figure, and how it moved.
 *
 * Every part of it arrives decided. The delta, its sign, and whether the
 * movement reads as good or bad are all fields on the response, because "is up
 * good" is a judgment about the business rather than a styling choice. This
 * component's whole job is turning a tone name into a class and a key into an
 * icon.
 *
 * ── Why an icon map is allowed here ──
 *
 * It is keyed on `metric.key`, which the API documents as a stable identifier
 * for exactly this ("a client that wants to place a specific tile"). It is not a
 * label map and not a tone map: it invents no wording and makes no severity
 * judgment, and a key this file has not seen gets a neutral chart glyph rather
 * than a blank. The same reasoning as mapping a tone onto a class.
 */

const METRIC_ICON: Record<string, IconSvgElement> = {
    activeProjects: Building03Icon,
    hoursLogged: Clock01Icon,
    openBlockers: AlertDiamondIcon,
    atRisk: AlertCircleIcon,
};

export function StatCard({
    metric,
    children,
}: {
    metric: DashboardMetric;
    /** An optional sparkline or bar strip, rendered under the figure. */
    children?: React.ReactNode;
}) {
    return (
        <Card
            size='sm'
            className='justify-between gap-4 transition-shadow hover:shadow-sm'>
            <div className='flex items-start justify-between gap-3 px-4'>
                <IconTile
                    icon={METRIC_ICON[metric.key] ?? ChartLineData01Icon}
                    tone={metric.tone.tone}
                />
                <DeltaPill
                    changeLabel={metric.changeLabel}
                    changeRate={metric.changeRate}
                    tone={metric.tone}
                />
            </div>

            <div className='px-4'>
                <p className='truncate text-sm font-medium text-content-muted'>
                    {metric.label}
                </p>
                <p className='mt-1 font-heading text-2xl font-medium tracking-tight tabular-nums text-content'>
                    {metric.valueLabel}
                </p>
                {metric.caption && (
                    <p className='mt-0.5 truncate text-2xs text-content-subtle'>
                        {metric.caption}
                    </p>
                )}
            </div>

            {/* Bleeds to the card's edges: a strip that stops short of them
                reads as a chart in a box rather than as the tile's own floor. */}
            {children && <div className={cn('px-1 pb-1')}>{children}</div>}
        </Card>
    );
}
