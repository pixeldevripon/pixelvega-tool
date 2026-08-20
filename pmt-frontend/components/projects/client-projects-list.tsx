'use client';

import Link from 'next/link';

import { EnumBadge } from '@/components/common/enum-badge';
import type { ClientProject } from '@/types/projects';

/**
 * What a client sees of their own projects.
 *
 * Its own component, not a mode of the internal list, because it renders a
 * different response: nine fields, with no priority, no team, no hours and no
 * capability flags. A shared component reading around the gaps would be one
 * `??` away from putting an internal figure on a client's screen the day the
 * backend starts sending it.
 *
 * There is no board and no timeline here either. Both group by the project
 * manager carrying the work, and who inside the agency is assigned to what is
 * not a client's business.
 */
export function ClientProjectsList({
    projects,
}: {
    projects: ClientProject[];
}) {
    return (
        <div className='overflow-hidden rounded-lg border border-line bg-surface-overlay'>
            <div className='hidden grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] gap-4 border-b border-line px-4 py-2.5 text-2xs font-medium uppercase tracking-caps text-content-subtle md:grid'>
                <span>Project</span>
                <span>Status</span>
                <span>Started</span>
                <span>Expected</span>
            </div>

            {projects.map((project) => (
                <div
                    key={project.id}
                    className='grid grid-cols-1 items-center gap-2 border-b border-line px-4 py-3 last:border-b-0 hover:bg-surface-raised md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] md:gap-4'>
                    <div className='min-w-0'>
                        <Link
                            href={`/projects/${project.id}`}
                            className='block truncate text-sm font-medium text-content hover:text-primary hover:underline'>
                            {project.name}
                        </Link>
                        <div className='mt-0.5 flex flex-wrap items-center gap-1'>
                            {project.projectTypeTags.map((tag) => (
                                <span
                                    key={tag.type.value}
                                    className='rounded-sm bg-surface-inset px-1.5 py-0.5 text-2xs font-medium text-content-muted'>
                                    {tag.type.label}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div>
                        <EnumBadge display={project.status} />
                    </div>

                    <ProjectDate value={project.plannedStartDate} />
                    {/* The delivery date, or the day it actually landed. No
                        countdown and no overdue flag: whether the agency is
                        behind its own plan is an internal measure. */}
                    <ProjectDate
                        value={project.completedAt ?? project.deadline}
                    />
                </div>
            ))}
        </div>
    );
}

function ProjectDate({ value }: { value: string | null }) {
    return (
        <span className='text-xs tabular-nums text-content-muted'>
            {value
                ? new Date(value).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                  })
                : 'To be confirmed'}
        </span>
    );
}
