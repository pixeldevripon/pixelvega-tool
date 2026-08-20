import type { Metadata } from 'next';
import { Suspense } from 'react';

import { BlockersListView } from '@/components/blockers/blockers-list-view';
import { DataTableSkeleton } from '@/components/data-table/data-table-skeleton';

export const metadata: Metadata = { title: 'Blockers' };

/**
 * A Server Component. The boundary is required rather than decorative: the view
 * reads `useSearchParams` through `useTableState`, and under `cacheComponents` a
 * component that reads the request outside `<Suspense>` fails the build.
 */
export default function BlockersPage() {
    return (
        <div className='flex flex-col gap-4'>
            <div>
                <h1 className='text-2xl font-medium'>Blockers</h1>
                <p className='mt-1 text-sm text-content-muted'>
                    What is holding work up, newest first
                </p>
            </div>
            <Suspense fallback={<DataTableSkeleton rows={8} columns={6} />}>
                <BlockersListView />
            </Suspense>
        </div>
    );
}
