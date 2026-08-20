import type { Metadata } from 'next';
import { Suspense } from 'react';

import { DataTableSkeleton } from '@/components/data-table/data-table-skeleton';
import { LeaveListView } from '@/components/leave/leave-list-view';

export const metadata: Metadata = { title: 'Leave' };

export default function LeavePage() {
    return (
        <div className='flex flex-col gap-4'>
            <div>
                <h1 className='text-2xl font-medium'>Leave</h1>
                <p className='mt-1 text-sm text-content-muted'>
                    Requests waiting on a decision, newest first
                </p>
            </div>
            <Suspense fallback={<DataTableSkeleton rows={8} columns={7} />}>
                <LeaveListView />
            </Suspense>
        </div>
    );
}
