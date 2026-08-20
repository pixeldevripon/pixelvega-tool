'use client';

import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Link from 'next/link';

import { BreakdownCard } from '@/components/common/stats/breakdown-card';
import { HoursChartCard } from '@/components/common/stats/hours-chart-card';
import { RankedList } from '@/components/common/stats/ranked-list';
import { SectionHeading } from '@/components/common/stats/section-heading';
import { StatCard } from '@/components/common/stats/stat-card';
import { AttentionCard } from '@/components/home/attention-card';
import { MyDayCard } from '@/components/home/my-day-card';
import { ProjectBoard } from '@/components/home/project-board';
import { StandupCard } from '@/components/home/standup-card';
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
 * ── The reading order, and why the board is first ──
 *
 * 1. **The work itself**, as a board. This used to be last, under four screens
 *    of aggregate, which put the answer to "what is happening" below every
 *    summary of it. A reader opening the dashboard wants the projects.
 * 2. The four headline figures, because they answer "is anything wrong" in one
 *    glance once you have seen the work.
 * 3. What is waiting: my own day, what needs attention, whether the team filed.
 * 4. Where the hours went, and how the portfolio is distributed. The chart is
 *    the widest thing down here because it is the only one with a shape.
 * 5. The leaderboards, which are context rather than a call to action.
 *
 * ── Every null is a permission gate ──
 *
 * `blockerBreakdown`, `topProjectsByHours`, `standupComplianceToday`,
 * `topContributors` and `myDay` are each null when the caller lacks the
 * permission for it, and the headline array arrives with forbidden tiles already
 * removed. Nothing here re-derives that from a role (D2), and nothing renders an
 * empty card in place of an absent one: an empty card claims a measured zero.
 *
 * There is no `.filter`, `.sort` or `.reduce` over API data anywhere in here.
 * Every figure, order, share, group and label arrived decided (D4).
 */
export function WorkspaceDashboardView({
    workspace,
}: {
    workspace: WorkspaceDashboard;
}) {
    return (
        <div className='flex flex-col gap-6'>
            {/* ── The work ── */}
            <section className='flex flex-col gap-3'>
                <SectionHeading
                    title='Projects'
                    count={workspace.projectTotal}
                    tone='primary'
                    action={
                        <Link
                            href='/projects'
                            className='flex items-center gap-1 text-xs font-medium text-content-muted transition-colors hover:text-primary'>
                            View all
                            <HugeiconsIcon
                                aria-hidden
                                icon={ArrowRight01Icon}
                                className='size-4'
                                strokeWidth={1.75}
                            />
                        </Link>
                    }
                />
                <ProjectBoard board={workspace.projectBoard} />
            </section>

            {/* ── The figures ── */}
            {/* Four across, lining up with the board's four lanes above.
                Every row below uses the same four-column grid and spans within
                it, so one set of gridlines runs down the whole page instead of
                a three-column row sitting under a four-column one. */}
            <section className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                {workspace.headline.map((metric) => (
                    <StatCard key={metric.key} metric={metric} />
                ))}
            </section>

            {/* ── What is waiting ──
                A project manager gets no "My day" and a caller without
                VIEW_WORK_REPORTS gets no standup gauge, so this row is
                legitimately two cards wide for some people.

                Cards in a row match, top AND bottom. That is a grid's default
                stretch, which is why neither `items-start` nor `h-full` appears
                anywhere here: `h-full` is `height: 100%` of a grid area whose
                height is already the tallest item, so it did nothing except make
                the mechanism harder to find.

                Getting there meant shrinking the CONTENT until the tallest card
                in each row was honest, rather than letting the grid paper over
                it. This row stood at 433 because "My day" carried its own
                sparkline, so "Needs attention" held six rows in 433 pixels with
                a third of it empty. The sparkline went, and the row is now as
                tall as the six rows that actually need the space. */}
            <section className='grid gap-3 lg:grid-cols-4'>
                {workspace.myDay && <MyDayCard myDay={workspace.myDay} />}
                <AttentionCard
                    attention={workspace.attention}
                    className='lg:col-span-2'
                />
                {workspace.standupComplianceToday && (
                    <StandupCard
                        compliance={workspace.standupComplianceToday}
                    />
                )}
            </section>

            {/* ── Where the time and the work went ──
                The chart takes two of the four columns, because a fortnight of
                bars needs the width. The two breakdowns take one each, and both
                keep the ring: the shape of the distribution is the reason to
                look at either of them. */}
            <section className='grid gap-3 lg:grid-cols-4'>
                <HoursChartCard
                    series={workspace.hoursTrend}
                    className='lg:col-span-2'
                />
                {/* A status slice is a summary of a filtered list, so it opens
                    that list. `?status=` is a real filter on `/projects`, so
                    the page holds exactly the projects the row counted. */}
                <BreakdownCard
                    breakdown={workspace.statusBreakdown}
                    // Ten statuses. Five is the ring plus a readable list; the
                    // rest are one click away.
                    collapseAfter={5}
                    sliceHref={(status) => `/projects?status=${status}`}
                />
                {workspace.blockerBreakdown && (
                    <BreakdownCard
                        breakdown={workspace.blockerBreakdown}
                        sliceHref={(severity) =>
                            `/blockers?severity=${severity}`
                        }
                    />
                )}
            </section>

            {/* ── Context ──
                Two columns each. A ranked row is a name, a figure and a delta,
                and at one column of four the names truncate to nothing useful. */}
            <section className='grid gap-3 lg:grid-cols-4'>
                {workspace.topProjectsByHours && (
                    <RankedList
                        list={workspace.topProjectsByHours}
                        className='lg:col-span-2'
                        // There is no project detail screen yet, so a row opens
                        // the list narrowed to that project rather than a page
                        // that does not exist.
                        rowHref={(row) =>
                            `/projects?search=${encodeURIComponent(row.name)}`
                        }
                    />
                )}
                {workspace.topContributors && (
                    <RankedList
                        list={workspace.topContributors}
                        className='lg:col-span-2'
                        showAvatars
                        rowHref={(row) =>
                            `/users?search=${encodeURIComponent(row.name)}`
                        }
                        emptyLabel='Nobody logged hours in this window.'
                    />
                )}
            </section>
        </div>
    );
}
