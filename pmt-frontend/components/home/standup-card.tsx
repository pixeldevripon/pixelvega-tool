'use client';

import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Link from 'next/link';

import { DonutChart } from '@/components/common/stats/donut-chart';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { useDeepLink } from '@/hooks/use-deep-link';
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
    // Null when this caller may not open the standups screen. The gauge still
    // renders; only the title stops being a link.
    const href = useDeepLink('standupCompliance');

    const caption = `${compliance.submitted} of ${compliance.expected} filed`;

    return (
        <Card size='sm' className='flex flex-col gap-3'>
            <CardHeader className='gap-0'>
                {href ? (
                    <Link
                        href={href}
                        className='group/title flex items-center gap-1 text-sm'>
                        <CardTitle className='text-sm transition-colors group-hover/title:text-primary'>
                            Standups today
                        </CardTitle>
                        <HugeiconsIcon
                            aria-hidden
                            icon={ArrowRight01Icon}
                            className='size-4 text-content-subtle transition-transform group-hover/title:translate-x-0.5'
                            strokeWidth={1.75}
                        />
                    </Link>
                ) : (
                    <CardTitle className='text-sm'>Standups today</CardTitle>
                )}
                <p className='text-2xs text-content-subtle'>{caption}</p>
            </CardHeader>

            <div className='flex flex-1 flex-col items-center justify-center gap-2 px-4 pb-4'>
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
