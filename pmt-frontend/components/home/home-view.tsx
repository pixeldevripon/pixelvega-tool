'use client';

import { ClientDashboardView } from '@/components/home/client-dashboard';
import { WorkspaceDashboardView } from '@/components/home/workspace-dashboard';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboard } from '@/hooks/dashboard/use-dashboard';

/**
 * The landing screen.
 *
 * ── It switches on `audience`, and on nothing else ──
 *
 * Not on the role, and not on which fields happen to be present. The server
 * decides which dashboard a caller gets, from their permission set, and says so
 * in one field. Inferring it here from "does `workspace` exist" would work until
 * the day a third block is added.
 *
 * All four states are handled explicitly, because an empty dashboard is the
 * common case on a fresh install and an error on the landing screen is the first
 * thing a new user would see.
 */
export function HomeView() {
    const { data, isPending, isError, error } = useDashboard();

    if (isPending) return <DashboardSkeleton />;

    if (isError) {
        return (
            <Card className='px-6 py-8'>
                <p className='text-sm font-medium text-content'>
                    The dashboard could not be loaded.
                </p>
                <p className='mt-1 text-sm text-content-muted'>
                    {/* `ApiError.message` is written to be safe to show
                        verbatim: raw technical text never reaches a user. */}
                    {error instanceof Error
                        ? error.message
                        : 'Please try again.'}
                </p>
            </Card>
        );
    }

    return (
        <div className='flex flex-col gap-4'>
            <div className='flex flex-wrap items-baseline justify-between gap-2'>
                <div>
                    <h1 className='text-2xl font-medium'>Overview</h1>
                    <p className='mt-1 text-sm text-content-muted'>
                        {data.range.label} · {data.audience.label} view
                    </p>
                </div>
            </div>

            {data.workspace ? (
                <WorkspaceDashboardView workspace={data.workspace} />
            ) : data.client ? (
                <ClientDashboardView client={data.client} />
            ) : (
                <Card className='px-6 py-8'>
                    <p className='text-sm text-content-muted'>
                        There is nothing to show on your dashboard yet.
                    </p>
                </Card>
            )}
        </div>
    );
}

/**
 * Mirrors the real layout's shape rather than being a generic spinner, so the
 * page does not jump when the data lands.
 */
function DashboardSkeleton() {
    return (
        <div className='flex flex-col gap-4'>
            <Skeleton className='h-9 w-40' />
            <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
                {[0, 1, 2, 3].map((index) => (
                    <Skeleton key={index} className='h-32 rounded-lg' />
                ))}
            </div>
            <div className='grid gap-4 lg:grid-cols-3'>
                <Skeleton className='h-72 rounded-lg lg:col-span-2' />
                <Skeleton className='h-72 rounded-lg' />
            </div>
            <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                {[0, 1, 2, 3, 4, 5].map((index) => (
                    <Skeleton key={index} className='h-44 rounded-lg' />
                ))}
            </div>
        </div>
    );
}
