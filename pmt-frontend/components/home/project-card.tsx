'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
    AlertDiamondIcon,
    Timer01Icon,
} from '@hugeicons/core-free-icons';
import Link from 'next/link';

import { EnumBadge } from '@/components/common/enum-badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { DashboardProject } from '@/types/dashboard';

/**
 * One project, as a card: status, who is working on it, its blockers, and its
 * progress.
 *
 * ── What this component does NOT decide ──
 *
 * Whether the project is at risk, how many days until its deadline, how that
 * reads in words, what share of the estimate is spent, who counts as currently
 * staffed, and whether the caller may manage it. All of those arrive as fields,
 * because each is a business rule and a second copy in a browser is a second
 * answer.
 *
 * `capabilities.canManage` is the reason two cards on one screen can legitimately
 * differ: a project manager sees every project and manages only their own.
 */

/** At most this many avatars, then a "+N" chip. Beyond it a row stops reading. */
const VISIBLE_MEMBERS = 4;

export function ProjectCard({ project }: { project: DashboardProject }) {
    const overflow = project.members.length - VISIBLE_MEMBERS;

    return (
        <Card
            className={cn(
                'flex flex-col gap-3 p-4 transition-colors',
                // A single flag drives the emphasis, so a card, a count and a
                // filter can never disagree about what "at risk" means.
                project.isAtRisk && 'border-danger-border bg-danger-subtle/30',
            )}>
            <div className='flex items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <Link
                        href={`/projects/${project.id}`}
                        className='block truncate text-sm font-medium text-content hover:text-primary hover:underline'>
                        {project.name}
                    </Link>
                    <div className='mt-1 flex flex-wrap items-center gap-1'>
                        {project.types.map((type) => (
                            <span
                                key={type.value}
                                className='rounded-sm bg-surface-inset px-1.5 py-0.5 text-2xs font-medium text-content-muted'>
                                {type.label}
                            </span>
                        ))}
                    </div>
                </div>
                <EnumBadge display={project.status} />
            </div>

            <div className='flex items-center gap-2 text-xs'>
                <EnumBadge display={project.priority} />
                {project.deadlineLabel && (
                    <span
                        className={cn(
                            'tabular-nums',
                            project.isOverdue
                                ? 'font-medium text-danger-fg'
                                : 'text-content-muted',
                        )}>
                        {project.deadlineLabel}
                    </span>
                )}
            </div>

            {/* Progress. The percentage is the lifecycle position; the hours
                line beside it is spend against estimate. Two different
                questions, deliberately not merged into one bar. */}
            <div className='flex flex-col gap-1'>
                <div className='flex items-baseline justify-between text-xs'>
                    <span className='text-content-muted'>
                        {project.progressPercentage}% through
                    </span>
                    {/* The LABELS, never the floats. `actualHours` is a sum of
                        minutes over sixty, so rendering it raw put
                        "56.083333333333336h" on screen. */}
                    <span className='tabular-nums text-content-muted'>
                        {project.estimatedHoursLabel
                            ? `${project.actualHoursLabel} of ${project.estimatedHoursLabel}`
                            : `${project.actualHoursLabel} logged`}
                    </span>
                </div>
                <div className='h-1.5 overflow-hidden rounded-full bg-surface-inset'>
                    <div
                        className='h-full rounded-full bg-primary'
                        style={{ width: `${project.progressPercentage}%` }}
                    />
                </div>
                {/* Over the estimate is worth saying out loud rather than
                    leaving as two numbers to compare. */}
                {project.hoursUsedRate !== null &&
                    project.hoursUsedRate > 1 && (
                        <p className='text-2xs font-medium text-warning-fg'>
                            {Math.round(project.hoursUsedRate * 100)}% of the
                            estimate used
                        </p>
                    )}
            </div>

            <div className='flex items-center justify-between gap-2 border-t border-line pt-3'>
                <div className='flex items-center'>
                    {project.members.slice(0, VISIBLE_MEMBERS).map((member) => (
                        <Avatar
                            key={member.id}
                            // Overlapped, with a ring so they stay distinct.
                            className='-mr-1.5 size-6 ring-2 ring-surface-overlay'
                            title={`${member.name} · ${member.projectRole.label}`}>
                            {member.avatarUrl && (
                                <AvatarImage src={member.avatarUrl} alt='' />
                            )}
                            <AvatarFallback className='text-2xs'>
                                {member.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                    ))}
                    {overflow > 0 && (
                        <span className='ml-2.5 text-2xs font-medium text-content-subtle'>
                            +{overflow}
                        </span>
                    )}
                    {project.members.length === 0 && (
                        <span className='text-2xs font-medium text-warning-fg'>
                            Nobody staffed
                        </span>
                    )}
                </div>

                <div className='flex items-center gap-2.5 text-xs text-content-muted'>
                    {project.openBlockerCount > 0 && (
                        <span
                            className={cn(
                                'flex items-center gap-1 tabular-nums',
                                project.highSeverityBlockerCount > 0 &&
                                    'font-medium text-danger-fg',
                            )}
                            title={
                                project.highSeverityBlockerCount > 0
                                    ? `${project.highSeverityBlockerCount} at high severity`
                                    : undefined
                            }>
                            <HugeiconsIcon
                                icon={AlertDiamondIcon}
                                className='size-3.5'
                                strokeWidth={1.75}
                            />
                            {project.openBlockerCount}
                        </span>
                    )}
                    {project.minutesInRange > 0 && (
                        <span className='flex items-center gap-1 tabular-nums'>
                            <HugeiconsIcon
                                icon={Timer01Icon}
                                className='size-3.5'
                                strokeWidth={1.75}
                            />
                            {project.minutesInRangeLabel}
                        </span>
                    )}
                </div>
            </div>
        </Card>
    );
}
