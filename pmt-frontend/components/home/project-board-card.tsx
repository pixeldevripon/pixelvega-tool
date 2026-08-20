'use client';

import {
    AlertDiamondIcon,
    Clock01Icon,
    PieChartIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import type { IconSvgElement } from '@hugeicons/react';
import Link from 'next/link';

import { EnumBadge } from '@/components/common/enum-badge';
import { MemberStack } from '@/components/common/member-stack';
import { cn } from '@/lib/utils';
import type { DashboardProject } from '@/types/dashboard';

/**
 * One project, as a board card.
 *
 * The reference's board card, in this order: the priority pill, the name, the
 * description, the team, and a metric row. The priority leads because it is the
 * one thing a reader scans a wall of cards for; the metrics sit on the floor
 * because they are what you check after you have decided which card you care
 * about.
 *
 * ── What this component does NOT decide ──
 *
 * Whether the project is at risk, how many days until its deadline, how that
 * reads in words, what share of the estimate is spent, who counts as currently
 * staffed, and whether the caller may manage it. Every one of those is a field,
 * because each is a business rule and a second copy in a browser is a second
 * answer (D4).
 *
 * ── An at-risk card is not tinted, and that is deliberate ──
 *
 * `isAtRisk` used to paint the whole card in the danger surface. It read as a
 * priority colour rather than a risk one, because a Critical or Urgent project
 * is usually also overdue or blocked, so nearly every high-priority card came
 * out pink and the tint stopped distinguishing anything. The badges already say
 * "Critical" and "On hold" in words, and the risk itself still shows where it is
 * specific: the deadline line goes red with an alert glyph, and a high-severity
 * blocker count goes red. `isAtRisk` remains the one flag any COUNT of at-risk
 * work is derived from; it simply no longer colours a whole card.
 *
 * ── There is no overflow menu ──
 *
 * The reference card carries a `⋮`. This one does not, because there are no
 * per-project actions built yet: changing status, priority or staffing all live
 * on the project itself. A menu that opens onto nothing is worse than no menu,
 * and `capabilities.canManage` is already on the response for when there is
 * something to put behind it.
 */

/** The metric row. Three at most: past that the floor of the card stops reading. */
function Metric({
    icon,
    value,
    title,
    className,
}: {
    icon: IconSvgElement;
    value: string;
    title: string;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'flex items-center gap-1 tabular-nums text-content-subtle',
                className,
            )}
            title={title}>
            <HugeiconsIcon
                aria-hidden
                icon={icon}
                className='size-3.5'
                strokeWidth={1.75}
            />
            {value}
        </span>
    );
}

export function ProjectBoardCard({ project }: { project: DashboardProject }) {
    return (
        <article className='flex flex-col gap-3 rounded-lg border border-line bg-surface-overlay p-4 transition-colors hover:border-line-strong'>
            <div className='flex items-start justify-between gap-2'>
                <EnumBadge display={project.priority} />
                {/* The status still shows on the card, which is what keeps a
                    lane honest: "Closed" holds cancelled projects too, and this
                    badge is what says which one this is. */}
                <EnumBadge display={project.status} />
            </div>

            <div>
                <Link
                    href={`/projects/${project.id}`}
                    className='block font-heading text-sm font-medium leading-snug text-content hover:text-primary hover:underline'>
                    {project.name}
                </Link>

                {/* Two lines ALWAYS, whether or not there is a description, so
                    a card with one line of text is not half the height of the
                    card beside it. Null means nobody wrote one, so the space is
                    left empty rather than filled with a placeholder. */}
                <p className='mt-1 line-clamp-2 min-h-8 text-xs leading-relaxed text-content-muted'>
                    {project.description}
                </p>
            </div>

            <div className='mt-auto flex items-center justify-between gap-2'>
                {/* `min-w-0` so the metrics keep their line, but NO
                    `overflow-hidden`: that clipped the rightmost avatar in half
                    whenever the row was tight, which read as a broken image
                    rather than as a tight row. The metrics are `shrink-0` and
                    `whitespace-nowrap`, which is what actually stops "87h 42m"
                    breaking across two lines. */}
                <div className='min-w-0'>
                    <MemberStack members={project.members} max={4} />
                </div>

                <div className='flex shrink-0 items-center gap-2.5 whitespace-nowrap text-2xs'>
                    {project.openBlockerCount > 0 && (
                        <Metric
                            icon={AlertDiamondIcon}
                            value={String(project.openBlockerCount)}
                            title={
                                project.highSeverityBlockerCount > 0
                                    ? `${project.highSeverityBlockerCount} at high severity`
                                    : `${project.openBlockerCount} open`
                            }
                            className={cn(
                                project.highSeverityBlockerCount > 0 &&
                                    'font-medium text-danger-fg',
                            )}
                        />
                    )}
                    <Metric
                        icon={Clock01Icon}
                        // The LABEL, never the float. `actualHours` is a sum of
                        // minutes over sixty, so rendering it raw put
                        // "54.88333333333333h" on a card.
                        value={project.actualHoursLabel}
                        title={
                            project.estimatedHoursLabel
                                ? `Logged, against an estimate of ${project.estimatedHoursLabel}`
                                : 'Logged in total'
                        }
                    />
                    <Metric
                        icon={PieChartIcon}
                        value={`${project.progressPercentage}%`}
                        title='Progress through the lifecycle'
                    />
                </div>
            </div>

            {/* Only when there is something to say. A card that always carries a
                deadline line spends a third of its height on "Not set", and the
                API's phrasing is used verbatim: printing the countdown a second
                time in our own words made a card read "347 days overdue · 347d
                overdue". */}
            {/* Nothing for finished work. A completed project keeps its
                deadline, so the label still reads "138 days overdue" and this
                card printed exactly that under a CANCELLED project. `isOverdue`
                cannot be the guard: it is deliberately false for these. */}
            {project.deadlineLabel && !project.isTerminal && (
                <div
                    className={cn(
                        'flex items-center gap-1 border-t border-line pt-3 text-2xs tabular-nums',
                        project.isOverdue
                            ? 'font-medium text-danger-fg'
                            : 'text-content-subtle',
                    )}>
                    {project.isOverdue && (
                        <HugeiconsIcon
                            aria-hidden
                            icon={AlertDiamondIcon}
                            className='size-3.5'
                            strokeWidth={1.75}
                        />
                    )}
                    {project.deadlineLabel}
                </div>
            )}
        </article>
    );
}
