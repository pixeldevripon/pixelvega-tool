'use client';

import { useMemo } from 'react';
import Link from 'next/link';

import {
    ProjectLeadAvatar,
    ProjectMemberStack,
} from '@/components/projects/project-lead-avatar';
import { groupByLead } from '@/components/projects/group-by-lead';
import {
    buildTimelineScale,
    groupColumns,
    placeOnTimeline,
    TIMELINE_ZOOMS,
    type TimelineScale,
    type TimelineZoom,
} from '@/components/projects/timeline-scale';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Project } from '@/types/projects';

/**
 * The timeline: every project as a bar across a shared axis, grouped by the
 * manager carrying it, at four zoom levels.
 *
 * This is the view that answers "what overlaps with what", which no table can:
 * two projects with different dates in a list look unrelated, and on an axis it
 * is obvious that one person is leading both of them in the same fortnight.
 *
 * ── The inline widths ──
 *
 * Bar offsets and column widths are computed percentages, so they cannot be
 * Tailwind classes: there is no finite set of them. `eslint.config.mjs` lists
 * this file for that reason. Every COLOUR here is still a token, which is the
 * part the rule exists to protect.
 *
 * ── The one `useMemo` in a list view ──
 *
 * The house rule is that a list view holds no memo that computes, because a
 * computation in a browser is usually a business rule in the wrong place. This
 * one is layout geometry keyed on the zoom and the rows, not a rule, and it is
 * memoised because it walks every column of a two-year axis.
 */
export function ProjectsTimeline({
    projects,
    zoom,
    onZoomChange,
    nowMs,
}: {
    projects: Project[];
    zoom: TimelineZoom;
    onZoomChange: (zoom: TimelineZoom) => void;
    /**
     * Passed in rather than read here so the axis matches the clock the response
     * was measured against, and so a test can pin a date.
     */
    nowMs: number;
}) {
    const scale = useMemo(
        () =>
            buildTimelineScale({
                zoom,
                nowMs,
                ranges: projects.map((project) => ({
                    start: project.plannedStartDate,
                    end: project.deadline,
                })),
            }),
        [zoom, nowMs, projects],
    );

    const groups = groupByLead(projects);
    const bands = groupColumns(scale.columns);

    return (
        <div className='flex flex-col gap-3'>
            <div className='flex items-center justify-between gap-3'>
                <p className='text-xs text-content-muted'>
                    {projects.length} project
                    {projects.length === 1 ? '' : 's'} on this page
                </p>

                <div
                    className='flex items-center gap-0.5 rounded-lg border border-line bg-surface-raised p-0.5'
                    role='group'
                    aria-label='Timeline zoom'>
                    {TIMELINE_ZOOMS.map((option) => (
                        <Button
                            key={option.value}
                            type='button'
                            size='sm'
                            variant={
                                option.value === zoom ? 'default' : 'ghost'
                            }
                            aria-pressed={option.value === zoom}
                            onClick={() => onZoomChange(option.value)}
                            className='h-7 px-3 text-xs'>
                            {option.label}
                        </Button>
                    ))}
                </div>
            </div>

            <div className='overflow-x-auto rounded-lg border border-line bg-surface-overlay'>
                {/* One width for the axis and every row inside it, so the grid
                    lines and the bars scroll as one thing. It comes from the
                    column count rather than being fixed: at day zoom over a
                    year the canvas is many screens wide, and squeezing it into
                    the frame truncated every label to one character. */}
                <div style={{ minWidth: `${scale.minWidthPx}px` }}>
                    <TimelineHeader scale={scale} bands={bands} />

                    {groups.map((group) => (
                        <section key={group.key ?? 'unled'}>
                            <header className='flex items-center gap-2 border-b border-line bg-surface-raised px-4 py-1.5'>
                                <ProjectLeadAvatar
                                    person={
                                        group.key
                                            ? {
                                                  id: group.key,
                                                  name: group.label,
                                                  avatarUrl: group.avatarUrl,
                                                  projectRole: {
                                                      value: 'PROJECT_MANAGER',
                                                      label: 'Project manager',
                                                      tone: 'default',
                                                  },
                                              }
                                            : null
                                    }
                                    className='size-5'
                                />
                                <span className='text-xs font-medium text-content'>
                                    {group.label}
                                </span>
                                <span className='text-2xs tabular-nums text-content-subtle'>
                                    {group.projects.length}
                                </span>
                            </header>

                            {group.projects.map((project) => (
                                <TimelineRow
                                    key={project.id}
                                    project={project}
                                    scale={scale}
                                />
                            ))}
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
}

/** The label column's width, shared by the header and every row. */
const LABEL_COLUMN = 'w-56 shrink-0';

function TimelineHeader({
    scale,
    bands,
}: {
    scale: TimelineScale;
    bands: ReturnType<typeof groupColumns>;
}) {
    return (
        <div className='sticky top-0 z-10 border-b border-line bg-surface-overlay'>
            <div className='flex'>
                <div
                    className={cn(
                        LABEL_COLUMN,
                        'border-r border-line px-4 py-1.5 text-2xs font-medium uppercase tracking-caps text-content-subtle',
                    )}>
                    Project
                </div>
                <div className='flex flex-1'>
                    {bands.map((band) => (
                        <div
                            key={band.key}
                            style={{ width: `${band.widthPercent}%` }}
                            className='truncate border-r border-line px-2 py-1.5 text-2xs font-medium text-content-muted last:border-r-0'>
                            {band.label}
                        </div>
                    ))}
                </div>
            </div>

            <div className='flex border-t border-line'>
                <div className={cn(LABEL_COLUMN, 'border-r border-line')} />
                <div className='flex flex-1'>
                    {scale.columns.map((column) => (
                        <div
                            key={column.key}
                            style={{ width: `${column.widthPercent}%` }}
                            className={cn(
                                'truncate border-r border-line px-1 py-1 text-center text-2xs tabular-nums text-content-subtle last:border-r-0',
                                column.isWeekend && 'bg-surface-inset',
                            )}>
                            {column.label}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function TimelineRow({
    project,
    scale,
}: {
    project: Project;
    scale: TimelineScale;
}) {
    const placement = placeOnTimeline(scale, {
        start: project.plannedStartDate,
        end: project.deadline,
    });

    return (
        <div className='flex border-b border-line last:border-b-0 hover:bg-surface-raised'>
            <div
                className={cn(
                    LABEL_COLUMN,
                    'border-r border-line px-4 py-2',
                )}>
                <Link
                    href={`/projects/${project.id}`}
                    className='block truncate text-xs font-medium text-content hover:text-primary hover:underline'>
                    {project.name}
                </Link>
                <div className='mt-1'>
                    <ProjectMemberStack members={project.members} max={3} />
                </div>
            </div>

            <div className='relative flex-1 py-2'>
                {/* The grid, redrawn per row so a bar sits on top of the lines
                    rather than beside a separate background layer that could
                    drift from them. */}
                <div className='absolute inset-0 flex'>
                    {scale.columns.map((column) => (
                        <div
                            key={column.key}
                            style={{ width: `${column.widthPercent}%` }}
                            className={cn(
                                'border-r border-line/60 last:border-r-0',
                                column.isWeekend && 'bg-surface-inset/60',
                            )}
                        />
                    ))}
                </div>

                {scale.todayPercent !== null && (
                    <div
                        style={{ left: `${scale.todayPercent}%` }}
                        className='absolute inset-y-0 w-px bg-primary/70'
                        aria-hidden
                    />
                )}

                {placement === null ? (
                    <p className='relative px-3 text-2xs text-content-subtle'>
                        Not scheduled
                    </p>
                ) : (
                    <div
                        style={{
                            left: `${placement.leftPercent}%`,
                            width: `${placement.widthPercent}%`,
                        }}
                        className='relative'>
                        <ProjectBar
                            project={project}
                            isMilestone={placement.isMilestone}
                            clippedStart={placement.clippedStart}
                            clippedEnd={placement.clippedEnd}
                            isOpenEnded={placement.isOpenEnded}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Bar colour comes from the project's own `status.tone`, which is the API's
 * judgment and the same one the badge beside it uses. Mapping a tone name to a
 * class is the only thing a client does with it.
 */
const TONE_TO_BAR: Record<string, string> = {
    success: 'bg-success-fg/80',
    warning: 'bg-warning-fg/80',
    danger: 'bg-danger-fg/80',
    info: 'bg-info-fg/80',
    default: 'bg-primary/80',
};

function ProjectBar({
    project,
    isMilestone,
    clippedStart,
    clippedEnd,
    isOpenEnded,
}: {
    project: Project;
    isMilestone: boolean;
    clippedStart: boolean;
    clippedEnd: boolean;
    isOpenEnded: boolean;
}) {
    // An overdue project reads as late whatever its status tone says, because
    // late is the more urgent of the two facts.
    const fill =
        project.isOverdue && !project.isTerminal
            ? 'bg-danger-fg/80'
            : (TONE_TO_BAR[project.status.tone] ?? TONE_TO_BAR.default);

    const title = [
        project.name,
        project.status.label,
        project.deadlineLabel,
        isMilestone ? 'no planned start' : null,
        isOpenEnded ? 'no deadline set' : null,
    ]
        .filter(Boolean)
        .join(' · ');

    if (isMilestone) {
        return (
            <div className='flex h-5 items-center justify-center' title={title}>
                {/* A diamond, not a bar: only the due date is known, and a bar
                    would have to invent a start and would then be read as one. */}
                <span
                    className={cn('size-3 rotate-45 rounded-[2px]', fill)}
                    aria-hidden
                />
                <span className='sr-only'>{title}</span>
            </div>
        );
    }

    return (
        <div
            className={cn(
                'flex h-5 min-w-1 items-center overflow-hidden rounded-sm px-2',
                fill,
                // A square edge says "this continues past the frame"; a rounded
                // one says "it ends here".
                clippedStart ? 'rounded-l-none' : '',
                clippedEnd || isOpenEnded ? 'rounded-r-none' : '',
            )}
            title={title}>
            <span className='truncate text-2xs font-medium text-surface'>
                {project.priority.label}
            </span>
            <span className='sr-only'>{title}</span>
        </div>
    );
}
