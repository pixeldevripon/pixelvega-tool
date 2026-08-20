import type { Metadata } from 'next';
import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { StandupsListView } from '@/components/standups/standups-list-view';

export const metadata: Metadata = { title: 'Standups' };

export default function StandupsPage() {
    return (
        <div className='flex flex-col gap-4'>
            <div>
                <h1 className='text-2xl font-medium'>Standups</h1>
                <p className='mt-1 text-sm text-content-muted'>
                    What people planned and what they finished, most recent first
                </p>
            </div>
            <Suspense fallback={<Skeleton className='h-96 w-full' />}>
                <StandupsListView />
            </Suspense>
        </div>
    );
}
