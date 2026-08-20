'use client';

import {
    ArrowRight01Icon,
    Comment01Icon,
    FolderLibraryIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Link from 'next/link';

import { EnumBadge } from '@/components/common/enum-badge';
import { IconTile } from '@/components/common/stats/icon-tile';
import { SectionHeading } from '@/components/common/stats/section-heading';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import type { ClientDashboard } from '@/types/dashboard';

/**
 * A client's overview: their own projects, the status, and the deadline.
 *
 * Deliberately sparse. `features.md`: "A client sees the status and the deadline,
 * and nothing else." The response for this audience does not carry hours,
 * blockers, team or capabilities at all, so there is nothing here to accidentally
 * render: the omission is enforced by the API's projection rather than by this
 * component remembering to leave things out.
 *
 * It shares the card kit with the internal overview so the two look like one
 * product, which is the only thing the redesign changed here.
 */
export function ClientDashboardView({ client }: { client: ClientDashboard }) {
    return (
        <div className='flex flex-col gap-6'>
            {client.awaitingMyFeedbackCount > 0 && (
                <Card
                    size='sm'
                    className='border-primary/40 bg-primary-subtle'>
                    <div className='flex items-center gap-3 px-4'>
                        <IconTile icon={Comment01Icon} tone='primary' />
                        <div className='min-w-0'>
                            <p className='text-sm font-medium text-primary-subtle-content'>
                                {client.awaitingMyFeedbackCount === 1
                                    ? '1 project is waiting for your feedback'
                                    : `${client.awaitingMyFeedbackCount} projects are waiting for your feedback`}
                            </p>
                            <p className='text-xs text-primary-subtle-content/80'>
                                Approve the work or ask for changes.
                            </p>
                        </div>
                    </div>
                </Card>
            )}

            <section className='flex flex-col gap-3'>
                <SectionHeading
                    title='Your projects'
                    count={client.projects.length}
                    tone='primary'
                />

                <Card className='gap-0 py-0'>
                    {client.projects.length === 0 ? (
                        <p className='px-6 py-8 text-sm text-content-muted'>
                            You have no active projects.
                        </p>
                    ) : (
                        client.projects.map((project) => (
                            <Link
                                key={project.id}
                                href={`/projects/${project.id}`}
                                className='group/row flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-raised'>
                                <div className='flex min-w-0 items-center gap-3'>
                                    <IconTile
                                        icon={FolderLibraryIcon}
                                        size='sm'
                                    />
                                    <div className='min-w-0'>
                                        <p className='truncate font-heading text-sm font-medium text-content'>
                                            {project.name}
                                        </p>
                                        {project.deadlineLabel && (
                                            <p className='text-2xs tabular-nums text-content-subtle'>
                                                {project.deadlineLabel}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className='flex items-center gap-2'>
                                    {project.isAwaitingMyFeedback && (
                                        <span className='rounded-full bg-primary-subtle px-2 py-0.5 text-2xs font-medium text-primary-subtle-content'>
                                            Your turn
                                        </span>
                                    )}
                                    <EnumBadge display={project.status} />
                                    <HugeiconsIcon
                                        aria-hidden
                                        icon={ArrowRight01Icon}
                                        className='size-4 shrink-0 text-content-subtle transition-transform group-hover/row:translate-x-0.5'
                                        strokeWidth={1.75}
                                    />
                                </div>
                            </Link>
                        ))
                    )}
                </Card>
            </section>
        </div>
    );
}
