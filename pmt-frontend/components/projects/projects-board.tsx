'use client';

import { AlertDiamondIcon, Clock01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Link from 'next/link';

import { EnumBadge } from '@/components/common/enum-badge';
import { groupByLead } from '@/components/projects/group-by-lead';
import {
    ProjectLeadAvatar,
    ProjectMemberStack,
} from '@/components/projects/project-lead-avatar';
import { cn } from '@/lib/utils';
import type { Project } from '@/types/projects';

/**
 * The board: one column per project manager, their projects stacked inside it.
 *
 * Columns are people rather than statuses, which is the unusual choice and the
 * deliberate one. Status is already a filter and a badge; "who is carrying how
 * much" is the question a board answers better than any table, and it is the
 * question a staffing decision turns on.
 *
 * Nothing here is draggable. Moving a card would mean reassigning a project's
 * manager, which is a membership change with its own permission
 * (`canManageMembers`) and its own audit entry, so it belongs on the project
 * rather than in a gesture that is easy to make by accident.
 */
export function ProjectsBoard({ projects }: { projects: Project[] }) {
    const groups = groupByLead(projects);

    return (
        <div className='flex gap-4 overflow-x-auto pb-2'>
            {groups.map((group) => (
                <section
                    key={group.key ?? 'unled'}
                    className='flex w-72 shrink-0 flex-col gap-3'>
                    <header className='flex items-center gap-2 rounded-lg border border-line bg-surface-raised px-3 py-2'>
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
                        />
                        <span className='min-w-0 flex-1 truncate text-sm font-medium text-content'>
                            {group.label}
                        </span>
                        <span className='rounded-full bg-surface-inset px-2 py-0.5 text-2xs font-medium tabular-nums text-content-muted'>
                            {group.projects.length}
                        </span>
                    </header>

                    <div className='flex flex-col gap-2'>
                        {group.projects.map((project) => (
                            <BoardCard key={project.id} project={project} />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}

function BoardCard({ project }: { project: Project }) {
    return (
        <article className='rounded-lg border border-line bg-surface-overlay p-3 transition-colors hover:border-line-strong'>
            <div className='flex items-start justify-between gap-2'>
                <Link
                    href={`/projects/${project.id}`}
                    className='min-w-0 flex-1 text-sm font-medium leading-snug text-content hover:text-primary hover:underline'>
                    {project.name}
                </Link>
                <EnumBadge display={project.priority} />
            </div>

            <div className='mt-2 flex flex-wrap items-center gap-1.5'>
                <EnumBadge display={project.status} />
                {project.projectTypeTags.slice(0, 2).map((tag) => (
                    <span
                        key={tag.id}
                        className='rounded-sm bg-surface-inset px-1.5 py-0.5 text-2xs font-medium text-content-muted'>
                        {tag.type.label}
                    </span>
                ))}
            </div>

            <div className='mt-3 flex items-center justify-between gap-2'>
                <ProjectMemberStack members={project.members} max={4} />

                <div className='flex items-center gap-1 text-2xs tabular-nums text-content-muted'>
                    <HugeiconsIcon
                        icon={Clock01Icon}
                        className='size-3.5'
                        strokeWidth={1.75}
                    />
                    {project.actualHoursLabel}
                    {project.estimatedHoursLabel &&
                        ` / ${project.estimatedHoursLabel}`}
                </div>
            </div>

            {/* Only when there is something to say. A card that always carries a
                deadline line spends a third of its height on "Not set". */}
            {project.deadline && !project.isTerminal && (
                <div
                    className={cn(
                        'mt-2 flex items-center gap-1 border-t border-line pt-2 text-2xs tabular-nums',
                        project.isOverdue
                            ? 'font-medium text-danger-fg'
                            : 'text-content-subtle',
                    )}>
                    {project.isOverdue && (
                        <HugeiconsIcon
                            icon={AlertDiamondIcon}
                            className='size-3.5'
                            strokeWidth={1.75}
                        />
                    )}
                    {/* The API's phrasing, and only that. This printed the
                        countdown a second time in its own words, so a card read
                        "347 days overdue · 347d overdue". */}
                    {project.deadlineLabel}
                </div>
            )}
        </article>
    );
}
