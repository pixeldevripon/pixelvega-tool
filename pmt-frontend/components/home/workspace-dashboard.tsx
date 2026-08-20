'use client';

import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Link from 'next/link';

import { BreakdownCard } from '@/components/common/stats/breakdown-card';
import { HoursChartCard } from '@/components/common/stats/hours-chart-card';
import { MiniBars } from '@/components/common/stats/mini-bars';
import { RankedList } from '@/components/common/stats/ranked-list';
import { SectionHeading } from '@/components/common/stats/section-heading';
import { StatCard } from '@/components/common/stats/stat-card';
import { AttentionCard } from '@/components/home/attention-card';
import { MyDayCard } from '@/components/home/my-day-card';
import { ProjectCard } from '@/components/home/project-card';
import { StandupCard } from '@/components/home/standup-card';
import { Card } from '@/components/ui/card';
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
 * ── The reading order, and why it is this one ──
 *
 * 1. The four headline figures, because they answer "is anything wrong" in one
 *    glance.
 * 2. Where the hours went, and how the portfolio is distributed. The chart is the
 *    widest thing on the page because it is the only one with a shape.
 * 3. What is waiting: my own day, what needs attention, whether the team filed.
 * 4. The leaderboards, which are context rather than a call to action.
 * 5. The projects themselves, last, because they are the detail behind
 *    everything above.
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
        <div className='flex flex-col gap-6'>
            {/* Headline tiles. The hours tile carries the trend strip, because
                hours are the one figure with a shape worth seeing at a glance. */}
            <section className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
                {workspace.headline.map((metric) => (
                    <StatCard key={metric.key} metric={metric}>
                        {metric.key === 'hoursLogged' && (
                            <MiniBars points={workspace.hoursTrend.points} />
                        )}
                    </StatCard>
                ))}
            </section>

            <section className='grid gap-4 lg:grid-cols-3'>
                <div className='lg:col-span-2'>
                    <HoursChartCard series={workspace.hoursTrend} />
                </div>
                <BreakdownCard breakdown={workspace.statusBreakdown} />
            </section>

            <section className='grid gap-4 lg:grid-cols-3'>
                {/* A project manager and a client get no "My day", so the row is
                    two cards wide for them rather than carrying a gap. */}
                {workspace.myDay && <MyDayCard myDay={workspace.myDay} />}
                <AttentionCard attention={workspace.attention} />
                <StandupCard compliance={workspace.standupComplianceToday} />
            </section>

            <section className='grid gap-4 lg:grid-cols-3'>
                <RankedList list={workspace.topProjectsByHours} />
                {workspace.topContributors && (
                    <RankedList
                        list={workspace.topContributors}
                        showAvatars
                        emptyLabel='Nobody logged hours in this window.'
                    />
                )}
                <BreakdownCard
                    breakdown={workspace.blockerBreakdown}
                    variant='bar'
                />
            </section>

            <section className='flex flex-col gap-3'>
                <SectionHeading
                    title='Projects'
                    count={workspace.projectTotal}
                    tone='primary'
                    action={
                        // Says plainly that the list is a slice, rather than
                        // letting a reader assume twelve is all there is.
                        untruncated > 0 ? (
                            <Link
                                href='/projects'
                                className='flex items-center gap-1 text-xs font-medium text-content-muted transition-colors hover:text-primary'>
                                {untruncated} more
                                <HugeiconsIcon
                                    aria-hidden
                                    icon={ArrowRight01Icon}
                                    className='size-4'
                                    strokeWidth={1.75}
                                />
                            </Link>
                        ) : undefined
                    }
                />

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
