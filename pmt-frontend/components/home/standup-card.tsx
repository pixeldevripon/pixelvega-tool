'use client';

import { DonutChart } from '@/components/common/stats/donut-chart';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardCompliance } from '@/types/dashboard';

/**
 * Today's standup compliance, as a gauge.
 *
 * ── Why `rate` is allowed to be null and is not treated as zero ──
 *
 * Null means nobody was expected to file today, which is not the same as nobody
 * filing. On a day the whole team is on leave those two answers are
 * indistinguishable from a number alone, so the gauge is not drawn at all and the
 * card says so in words.
 *
 * The two arcs are built from `rate` and its complement. That subtraction is the
 * only arithmetic here and it is geometry rather than a business rule: the
 * server decided what share filed, and a ring has to close.
 */
export function StandupCard({
    compliance,
}: {
    compliance: DashboardCompliance;
}) {
    return (
        <Card className='flex h-full flex-col gap-4'>
            <CardHeader className='gap-0'>
                <CardTitle className='text-base'>Standups today</CardTitle>
                <p className='text-xs text-content-subtle'>
                    {compliance.submitted} of {compliance.expected} filed
                </p>
            </CardHeader>

            <div className='flex flex-1 flex-col items-center justify-center gap-3 px-6 pb-6'>
                {compliance.rate === null || compliance.rateLabel === null ? (
                    <p className='py-6 text-center text-sm text-content-muted'>
                        Nobody was expected to file today.
                    </p>
                ) : (
                    <>
                        <DonutChart
                            slices={[
                                {
                                    value: 'submitted',
                                    label: 'Filed',
                                    tone: 'success',
                                    share: compliance.rate,
                                    detail: `${compliance.submitted} filed`,
                                },
                                {
                                    value: 'outstanding',
                                    label: 'Outstanding',
                                    tone: 'default',
                                    share: 1 - compliance.rate,
                                    // No count: subtracting one field from
                                    // another is how a third number that
                                    // disagrees with both gets onto a screen.
                                    // The header already says "9 of 12 filed".
                                    detail: 'Not filed yet',
                                    // The rest of the ring, not a measured
                                    // slice. Without this it draws in the
                                    // neutral tone, which is a text colour, and
                                    // an empty gauge came out charcoal.
                                    isTrack: true,
                                },
                            ]}
                            centreValue={compliance.rateLabel}
                            centreCaption='filed'
                        />
                        <p className='text-xs text-content-subtle'>
                            Across everyone required to file
                        </p>
                    </>
                )}
            </div>
        </Card>
    );
}
