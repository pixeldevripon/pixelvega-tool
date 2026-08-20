'use client';

import Link from 'next/link';

import { BreakdownCard } from '@/components/common/stats/breakdown-card';
import { HoursChartCard } from '@/components/common/stats/hours-chart-card';
import { MiniBars } from '@/components/common/stats/mini-bars';
import { RankedList } from '@/components/common/stats/ranked-list';
import { StatCard } from '@/components/common/stats/stat-card';
import { AttentionCard } from '@/components/home/attention-card';
import { MyDayCard } from '@/components/home/my-day-card';
import { ProjectCard } from '@/components/home/project-card';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import type { WorkspaceDashboard } from '@/types/dashboard';

/**
 * The overview, for an administrator, a project manager and a delivery member
 * alike.
 *
 * ONE layout for all three, because they want the same picture of the work and
 * only the SCOPE differs, which the server has already applied. Sections the
 * caller has no business seeing arrive as null and simply do not render, so this
 * component never asks who is looking.
 *
 * There is no `.filter`, `.sort` or `.reduce` over API data anywhere in here.
 * Every figure, order, share and label arrived decided (D4).
 */
export function WorkspaceDashboardView({
    workspace,
}: {
    workspace: WorkspaceDashboard;
}) {
    const untruncated = workspace.projectTotal - workspace.projects.length;

    return (
        <div className='flex flex-col gap-4'>
            {/* Headline tiles. The first carries the trend strip, because hours
                are the one figure with a shape worth seeing at a glance. */}
            <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
                {workspace.headline.map((metric) => (
                    <StatCard key={metric.key} metric={metric}>
                        {metric.key === 'hoursLogged' && (
                            <MiniBars points={workspace.hoursTrend.points} />
                        )}
                    </StatCard>
                ))}
            </div>

            <div className='grid gap-4 lg:grid-cols-3'>
                <div className='lg:col-span-2'>
                    <HoursChartCard series={workspace.hoursTrend} />
                </div>
                <div className='flex flex-col gap-4'>
                    <BreakdownCard breakdown={workspace.statusBreakdown} />
                </div>
            </div>

            <div className='grid gap-4 lg:grid-cols-3'>
                <RankedList list={workspace.topProjectsByHours} />
                {workspace.topContributors && (
                    <RankedList
                        list={workspace.topContributors}
                        showAvatars
                    />
                )}
                <BreakdownCard breakdown={workspace.blockerBreakdown} />
            </div>

            <div className='grid gap-4 lg:grid-cols-3'>
                {workspace.myDay && (
                    <MyDayCard myDay={workspace.myDay} />
                )}
                <AttentionCard attention={workspace.attention} />
                <Card className='flex flex-col'>
                    <CardHeader className='pb-3'>
                        <CardTitle className='text-base'>
                            Standups today
                        </CardTitle>
                    </CardHeader>
                    <div className='px-6 pb-6'>
                        <p className='text-2xl font-medium tabular-nums text-content'>
                            {workspace.standupComplianceToday.submitted} of{' '}
                            {workspace.standupComplianceToday.expected}
                        </p>
                        <p className='mt-1 text-sm text-content-muted'>
                            {/* Null when nobody was expected, which is not the
                                same as nobody submitting. */}
                            {workspace.standupComplianceToday.rateLabel ??
                                'Nobody was expected today'}
                        </p>
                    </div>
                </Card>
            </div>

            <section className='flex flex-col gap-3'>
                <div className='flex items-baseline justify-between gap-3'>
                    <h2 className='text-base font-medium text-content'>
                        Projects
                    </h2>
                    {/* Says plainly that the list is a slice, rather than
                        letting a reader assume twelve is all there is. */}
                    {untruncated > 0 && (
                        <Link
                            href='/projects'
                            className='text-sm font-medium text-content-muted hover:text-primary hover:underline'>
                            {untruncated} more in {workspace.projectTotal} total
                        </Link>
                    )}
                </div>

                {workspace.projects.length === 0 ? (
                    <Card className='px-6 py-8'>
                        <p className='text-sm text-content-muted'>
                            No projects are assigned to you yet.
                        </p>
                    </Card>
                ) : (
                    <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                        {workspace.projects.map((project) => (
                            <ProjectCard key={project.id} project={project} />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
