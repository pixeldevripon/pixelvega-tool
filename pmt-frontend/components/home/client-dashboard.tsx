'use client';

import { EnumBadge } from '@/components/common/enum-badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ClientDashboard } from '@/types/dashboard';

/**
 * A client's overview: their own projects, the status, and the deadline.
 *
 * Deliberately sparse. `features.md`: "A client sees the status and the deadline,
 * and nothing else." The response for this audience does not carry hours,
 * blockers, team or capabilities at all, so there is nothing here to accidentally
 * render: the omission is enforced by the API's projection rather than by this
 * component remembering to leave things out.
 */
export function ClientDashboardView({ client }: { client: ClientDashboard }) {
    return (
        <div className='flex flex-col gap-4'>
            {client.awaitingMyFeedbackCount > 0 && (
                <Card className='border-primary/40 bg-primary-subtle px-6 py-4'>
                    <p className='text-sm font-medium text-primary-subtle-content'>
                        {client.awaitingMyFeedbackCount === 1
                            ? '1 project is waiting for your feedback'
                            : `${client.awaitingMyFeedbackCount} projects are waiting for your feedback`}
                    </p>
                </Card>
            )}

            <Card className='flex flex-col'>
                <CardHeader className='pb-3'>
                    <CardTitle className='text-base'>Your projects</CardTitle>
                </CardHeader>

                <div className='flex flex-col px-6 pb-6'>
                    {client.projects.length === 0 ? (
                        <p className='text-sm text-content-muted'>
                            You have no active projects.
                        </p>
                    ) : (
                        client.projects.map((project) => (
                            <div
                                key={project.id}
                                className={cn(
                                    'flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 last:border-b-0',
                                )}>
                                <div className='min-w-0'>
                                    <p className='truncate text-sm font-medium text-content'>
                                        {project.name}
                                    </p>
                                    {project.deadlineLabel && (
                                        <p className='text-xs text-content-muted'>
                                            {project.deadlineLabel}
                                        </p>
                                    )}
                                </div>
                                <div className='flex items-center gap-2'>
                                    {project.isAwaitingMyFeedback && (
                                        <span className='rounded-full bg-primary-subtle px-2 py-0.5 text-2xs font-medium text-primary-subtle-content'>
                                            Your turn
                                        </span>
                                    )}
                                    <EnumBadge display={project.status} />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Card>
        </div>
    );
}
