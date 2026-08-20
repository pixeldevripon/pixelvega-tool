'use client';

import {
    AlertCircleIcon,
    AlertDiamondIcon,
    Building03Icon,
    ChartLineData01Icon,
    Clock01Icon,
} from '@hugeicons/core-free-icons';
import type { IconSvgElement } from '@hugeicons/react';

import Link from 'next/link';

import { DeltaPill } from '@/components/common/stats/delta-pill';
import { IconTile } from '@/components/common/stats/icon-tile';
import { Card } from '@/components/ui/card';
import { useDeepLink } from '@/hooks/use-deep-link';
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

export function StatCard({ metric }: { metric: DashboardMetric }) {
    /**
     * Where the figure's detail lives, or null.
     *
     * Null for any of three reasons the registry knows and this does not: the
     * key has no destination, the screen is not built yet, or this caller may
     * not reach it. A tile with no href still renders the number; it is simply
     * not a link, which is better than a click that 404s or 403s.
     */
    const href = useDeepLink(metric.key);

    const body = (
        <>
            <div className='flex items-start justify-between gap-2 px-4'>
                <IconTile
                    icon={METRIC_ICON[metric.key] ?? ChartLineData01Icon}
                    tone={metric.tone.tone}
                    size='sm'
                />
                <DeltaPill
                    changeLabel={metric.changeLabel}
                    changeRate={metric.changeRate}
                    tone={metric.tone}
                />
            </div>

            <div className='px-4'>
                <p className='truncate text-xs font-medium text-content-muted'>
                    {metric.label}
                </p>
                {/* `text-xl`, down from `text-2xl`. The sparkline that used to
                    sit under this went with it: the hours chart below owns the
                    trend, and a tile carrying its own copy made the first row
                    of the page as tall as the chart it duplicated. */}
                <p className='mt-0.5 font-heading text-xl font-medium tracking-tight tabular-nums text-content'>
                    {metric.valueLabel}
                </p>
                {metric.caption && (
                    <p className='truncate text-2xs text-content-subtle'>
                        {metric.caption}
                    </p>
                )}
            </div>
        </>
    );

    if (!href) {
        return (
            <Card size='sm' className='justify-between gap-3'>
                {body}
            </Card>
        );
    }

    // The Link wraps the Card rather than the Card rendering as an anchor: this
    // primitive has no `asChild`, and an `<a>` accepts flow content, so the
    // whole tile is the hit area either way.
    return (
        <Link
            href={href}
            aria-label={`${metric.label}: ${metric.valueLabel}`}
            className='group/tile block'>
            <Card
                size='sm'
                className='h-full justify-between gap-3 transition-colors group-hover/tile:border-line-strong group-hover/tile:shadow-sm'>
                {body}
            </Card>
        </Link>
    );
}
