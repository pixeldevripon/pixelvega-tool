import type { Metadata } from 'next';
import { Suspense } from 'react';

import { DataTableSkeleton } from '@/components/data-table/data-table-skeleton';
import { UsersListView } from '@/components/users/users-list-view';

export const metadata: Metadata = { title: 'Team' };

export default function UsersPage() {
    return (
        <div className='flex flex-col gap-4'>
            <div>
                <h1 className='text-2xl font-medium'>Team</h1>
                <p className='mt-1 text-sm text-content-muted'>
                    Everyone with an account, alphabetically
                </p>
            </div>
            <Suspense fallback={<DataTableSkeleton rows={8} columns={5} />}>
                <UsersListView />
            </Suspense>
        </div>
    );
}
