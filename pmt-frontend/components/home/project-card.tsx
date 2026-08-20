'use client';

import {
    AlertDiamondIcon,
    Timer01Icon,
    UserGroupIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Link from 'next/link';

import { EnumBadge } from '@/components/common/enum-badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { DashboardProject } from '@/types/dashboard';

/**
 * One project, as a board card: priority, status, who is on it, its blockers, and
 * its progress.
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
            size='sm'
            className={cn(
                'gap-3 transition-shadow hover:shadow-sm',
                // A single flag drives the emphasis, so a card, a count and a
                // filter can never disagree about what "at risk" means.
                project.isAtRisk && 'border-danger-border bg-danger-subtle/25',
            )}>
            {/* The priority pill leads, as it does on the reference's board
                card: it is the one thing a reader scans a wall of cards for. */}
            <div className='flex items-start justify-between gap-2 px-4'>
                <EnumBadge display={project.priority} />
                <EnumBadge display={project.status} />
            </div>

            <div className='px-4'>
                <Link
                    href={`/projects/${project.id}`}
                    className='font-heading text-sm font-medium text-content hover:text-primary hover:underline'>
                    {project.name}
                </Link>

                <p className='mt-1 text-xs text-content-muted'>
                    {/* The LABELS, never the floats. `actualHours` is a sum of
                        minutes over sixty, so rendering it raw put
                        "56.083333333333336h" on screen. */}
                    {project.estimatedHoursLabel
                        ? `${project.actualHoursLabel} of ${project.estimatedHoursLabel}`
                        : `${project.actualHoursLabel} logged`}
                    {project.deadlineLabel && (
                        <>
                            {' · '}
                            <span
                                className={cn(
                                    'tabular-nums',
                                    project.isOverdue &&
                                        'font-medium text-danger-fg',
                                )}>
                                {project.deadlineLabel}
                            </span>
                        </>
                    )}
                </p>

                {project.types.length > 0 && (
                    <div className='mt-2 flex flex-wrap items-center gap-1'>
                        {project.types.map((type) => (
                            <span
                                key={type.value}
                                className='rounded-sm bg-surface-inset px-1.5 py-0.5 text-2xs font-medium text-content-muted'>
                                {type.label}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Progress. The percentage is the lifecycle position; the hours
                line above it is spend against estimate. Two different
                questions, deliberately not merged into one bar. */}
            <div className='flex flex-col gap-1 px-4'>
                <div className='flex items-baseline justify-between text-2xs'>
                    <span className='text-content-subtle'>
                        {project.progressPercentage}% through
                    </span>
                    {/* Over the estimate is worth saying out loud rather than
                        leaving as two numbers to compare. */}
                    {project.hoursUsedRate !== null &&
                        project.hoursUsedRate > 1 && (
                            <span className='font-medium text-warning-fg'>
                                over estimate
                            </span>
                        )}
                </div>
                <div className='h-1.5 overflow-hidden rounded-full bg-surface-inset'>
                    <div
                        className={cn(
                            'h-full rounded-full',
                            project.isAtRisk ? 'bg-danger-solid' : 'bg-primary',
                        )}
                        style={{ width: `${project.progressPercentage}%` }}
                    />
                </div>
            </div>

            <div className='flex items-center justify-between gap-2 border-t border-line px-4 pt-3'>
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
                        <span className='ml-2 inline-flex size-6 items-center justify-center rounded-full bg-surface-inset text-2xs font-medium tabular-nums text-content-muted ring-2 ring-surface-overlay'>
                            +{overflow}
                        </span>
                    )}
                    {project.members.length === 0 && (
                        <span className='flex items-center gap-1 text-2xs font-medium text-warning-fg'>
                            <HugeiconsIcon
                                aria-hidden
                                icon={UserGroupIcon}
                                className='size-3.5'
                                strokeWidth={1.75}
                            />
                            Nobody staffed
                        </span>
                    )}
                </div>

                <div className='flex items-center gap-3 text-xs text-content-muted'>
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
                                    : `${project.openBlockerCount} open`
                            }>
                            <HugeiconsIcon
                                aria-hidden
                                icon={AlertDiamondIcon}
                                className='size-3.5'
                                strokeWidth={1.75}
                            />
                            {project.openBlockerCount}
                        </span>
                    )}
                    {project.minutesInRange > 0 && (
                        <span
                            className='flex items-center gap-1 tabular-nums'
                            title='Logged in this window'>
                            <HugeiconsIcon
                                aria-hidden
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
