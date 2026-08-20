'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { AlertDiamondIcon } from '@hugeicons/core-free-icons';
import Link from 'next/link';

import { EnumBadge } from '@/components/common/enum-badge';
import {
    ProjectLeadAvatar,
    ProjectMemberStack,
} from '@/components/projects/project-lead-avatar';
import { groupByLead } from '@/components/projects/group-by-lead';
import { cn } from '@/lib/utils';
import type { Project } from '@/types/projects';

/**
 * The list view: rows grouped under the project manager responsible for them.
 *
 * Grouped rather than flat because "whose work is this" is the first question a
 * manager asks of a project list, and a flat table makes it the hardest to
 * answer. The order inside each group is the server's sort, untouched.
 *
 * Not the shared `DataTable`: that component owns a header, selection and
 * pagination for ONE flat body, and grouped sections with their own headers do
 * not fit inside it without reaching past its API. Paging is handled by the view
 * that wraps this.
 */
export function ProjectsList({ projects }: { projects: Project[] }) {
    const groups = groupByLead(projects);

    return (
        <div className='overflow-hidden rounded-lg border border-line bg-surface-overlay'>
            <div className='hidden grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto] gap-4 border-b border-line px-4 py-2.5 text-2xs font-medium uppercase tracking-caps text-content-subtle md:grid'>
                <span>Project</span>
                <span>Status</span>
                <span>Priority</span>
                <span>Team</span>
                <span>Deadline</span>
                <span className='text-right'>Hours</span>
            </div>

            {groups.map((group) => (
                <section key={group.key ?? 'unled'}>
                    <header className='flex items-center gap-2 border-b border-line bg-surface-raised px-4 py-2'>
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
                        <span className='text-sm font-medium text-content'>
                            {group.label}
                        </span>
                        <span className='text-xs tabular-nums text-content-subtle'>
                            {group.projects.length}
                        </span>
                    </header>

                    {group.projects.map((project) => (
                        <ProjectRow key={project.id} project={project} />
                    ))}
                </section>
            ))}
        </div>
    );
}

function ProjectRow({ project }: { project: Project }) {
    return (
        <div className='grid grid-cols-1 items-center gap-2 border-b border-line px-4 py-3 last:border-b-0 hover:bg-surface-raised md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto] md:gap-4'>
            <div className='min-w-0'>
                <Link
                    href={`/projects/${project.id}`}
                    className='block truncate text-sm font-medium text-content hover:text-primary hover:underline'>
                    {project.name}
                </Link>
                <div className='mt-0.5 flex flex-wrap items-center gap-1'>
                    {project.projectTypeTags.map((tag) => (
                        <span
                            key={tag.id}
                            className='rounded-sm bg-surface-inset px-1.5 py-0.5 text-2xs font-medium text-content-muted'>
                            {tag.type.label}
                        </span>
                    ))}
                </div>
            </div>

            <div className='flex items-center gap-2'>
                <EnumBadge display={project.status} />
            </div>

            <div className='flex items-center gap-2'>
                <EnumBadge display={project.priority} />
            </div>

            <ProjectMemberStack members={project.members} max={3} />

            <div className='min-w-0 text-xs'>
                {project.deadline ? (
                    <>
                        <span className='flex items-center gap-1 tabular-nums text-content'>
                            {/* Beside the date it qualifies. It used to sit in
                                the hours cell, where a red warning read as a
                                problem with the hours. */}
                            {project.isOverdue && !project.isTerminal && (
                                <HugeiconsIcon
                                    icon={AlertDiamondIcon}
                                    className='size-3.5 shrink-0 text-danger-fg'
                                    strokeWidth={1.75}
                                />
                            )}
                            {new Date(project.deadline).toLocaleDateString(
                                undefined,
                                { day: 'numeric', month: 'short', year: 'numeric' },
                            )}
                        </span>
                        {/* No countdown on a finished project: there is nothing
                            left to be left. */}
                        {project.deadlineLabel && !project.isTerminal && (
                            <span
                                className={cn(
                                    'block tabular-nums',
                                    project.isOverdue
                                        ? 'font-medium text-danger-fg'
                                        : 'text-content-muted',
                                )}>
                                {project.deadlineLabel}
                            </span>
                        )}
                    </>
                ) : (
                    <span className='text-content-subtle'>Not set</span>
                )}
            </div>

            <div className='flex items-center justify-end gap-2 text-xs tabular-nums text-content-muted'>
                {project.actualHoursLabel}
                {project.estimatedHoursLabel &&
                    ` / ${project.estimatedHoursLabel}`}
            </div>
        </div>
    );
}
