import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { DashboardMyDay } from '@/types/dashboard';

import { MyDayCard } from './my-day-card';

const myDay = (overrides: Partial<DashboardMyDay> = {}): DashboardMyDay => ({
    activeTimer: null,
    today: { minutes: 210, hours: 3.5, label: '3h 30m' },
    thisWeek: { minutes: 1800, hours: 30, label: '30h' },
    weekTargetMinutes: 2880,
    weekTargetLabel: '48h',
    weekProgressRate: 0.625,
    weekProgressLabel: '63%',
    myHoursTrend: {
        label: 'My hours',
        points: [
            {
                date: '2026-08-17',
                label: 'Mon 17',
                value: 480,
                valueLabel: '8h',
                isWorkingDay: true,
                isPeak: true,
            },
        ],
        totalValue: 480,
        totalLabel: '8h',
        dailyTarget: 480,
    },
    todayWorkReportStatus: null,
    myOpenBlockerCount: 0,
    ...overrides,
});

/** The week bar, which is the only element carrying an inline width. */
const weekBar = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('div')).find(
        (element) => element.style.width !== '',
    );

describe('MyDayCard', () => {
    it('renders the week progress the server computed', () => {
        render(<MyDayCard myDay={myDay()} />);

        expect(screen.getByText('63%')).toBeInTheDocument();
    });

    it('sizes the bar from the rate, not from a division of its own', () => {
        const { container } = render(<MyDayCard myDay={myDay()} />);

        expect(weekBar(container)?.style.width).toBe('62.5%');
    });

    it('lets the bar overflow rather than clamping the rate', () => {
        // Sixty hours into a forty eight hour week is 125%, and that is the
        // point. Clamping would throw away the only figure that says so.
        const { container } = render(
            <MyDayCard
                myDay={myDay({
                    weekProgressRate: 1.25,
                    weekProgressLabel: '125%',
                    thisWeek: { minutes: 3600, hours: 60, label: '60h' },
                })}
            />,
        );

        expect(weekBar(container)?.style.width).toBe('125%');
        expect(screen.getByText('125%')).toBeInTheDocument();
    });

    it('draws no bar at all when there is no target to measure against', () => {
        // Null is not zero: no target means the question does not apply, and an
        // empty track would claim a measured result of nothing.
        const { container } = render(
            <MyDayCard
                myDay={myDay({
                    weekProgressRate: null,
                    weekProgressLabel: null,
                })}
            />,
        );

        expect(screen.queryByText('Week progress')).not.toBeInTheDocument();
        expect(weekBar(container)).toBeUndefined();
    });

    it('draws the bar at zero when the target exists and nothing was logged', () => {
        // This IS a measured result, unlike the case above, and it should look
        // like one.
        const { container } = render(
            <MyDayCard
                myDay={myDay({
                    weekProgressRate: 0,
                    weekProgressLabel: '0%',
                    thisWeek: { minutes: 0, hours: 0, label: '0m' },
                })}
            />,
        );

        expect(screen.getByText('0%')).toBeInTheDocument();
        expect(weekBar(container)?.style.width).toBe('0%');
    });

    it('renders the target label the server sent, never a division by sixty', () => {
        render(<MyDayCard myDay={myDay({ weekTargetLabel: '36h' })} />);

        expect(screen.getByText('Against a 36h week')).toBeInTheDocument();
    });

    it('renders the running timer with the server elapsed figure', () => {
        render(
            <MyDayCard
                myDay={myDay({
                    activeTimer: {
                        timeEntryId: 'te-1',
                        projectId: 'p-1',
                        projectName: 'Acme corporate site',
                        startedAt: '2026-08-20T09:15:00.000Z',
                        status: {
                            value: 'RUNNING',
                            label: 'Running',
                            tone: 'success',
                        },
                        elapsedMinutes: 95,
                        elapsedLabel: '1h 35m',
                    },
                })}
            />,
        );

        expect(screen.getByText('Acme corporate site')).toBeInTheDocument();
        expect(screen.getByText('Running · 1h 35m')).toBeInTheDocument();
    });

    it('names a project-less timer as meeting time', () => {
        render(
            <MyDayCard
                myDay={myDay({
                    activeTimer: {
                        timeEntryId: 'te-2',
                        projectId: null,
                        projectName: null,
                        startedAt: '2026-08-20T09:15:00.000Z',
                        status: {
                            value: 'PAUSED',
                            label: 'Paused',
                            tone: 'warning',
                        },
                        elapsedMinutes: 12,
                        elapsedLabel: '12m',
                    },
                })}
            />,
        );

        expect(screen.getByText('Meeting time')).toBeInTheDocument();
    });

    it('says so when no timer is running', () => {
        render(<MyDayCard myDay={myDay()} />);

        expect(screen.getByText('No timer running.')).toBeInTheDocument();
    });

    it('renders the standup status badge when there is one', () => {
        render(
            <MyDayCard
                myDay={myDay({
                    todayWorkReportStatus: {
                        value: 'PLAN_SUBMITTED',
                        label: 'Plan submitted',
                        tone: 'primary',
                    },
                })}
            />,
        );

        expect(screen.getByText('Plan submitted')).toBeInTheDocument();
    });

    it('says not started when today has no standup', () => {
        render(<MyDayCard myDay={myDay()} />);

        expect(screen.getByText('Not started')).toBeInTheDocument();
    });

    it('hides the blocker row when the caller has none', () => {
        render(<MyDayCard myDay={myDay()} />);

        expect(screen.queryByText('My blockers')).not.toBeInTheDocument();
    });

    it('shows the blocker count when the caller has some', () => {
        render(<MyDayCard myDay={myDay({ myOpenBlockerCount: 2 })} />);

        expect(screen.getByText('My blockers')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('renders no personal sparkline', () => {
        /**
         * Deliberately absent. It made this the tallest card in its row, which
         * held the two beside it open with a hole in each, and the team's hours
         * chart lower down is the page's real trend. Pinned so it does not
         * creep back: nothing asserted its presence before, so removing it
         * broke no test at all.
         */
        render(<MyDayCard myDay={myDay()} />);

        expect(screen.queryByText('My hours')).not.toBeInTheDocument();
    });
});
