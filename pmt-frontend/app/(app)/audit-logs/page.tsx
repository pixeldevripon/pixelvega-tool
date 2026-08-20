import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AuditLogsListView } from '@/components/audit-logs/audit-logs-list-view';
import { DataTableSkeleton } from '@/components/data-table/data-table-skeleton';

export const metadata: Metadata = { title: 'Audit log' };

export default function AuditLogsPage() {
    return (
        <div className='flex flex-col gap-4'>
            <div>
                <h1 className='text-2xl font-medium'>Audit log</h1>
                <p className='mt-1 text-sm text-content-muted'>
                    Every recorded action, most recent first
                </p>
            </div>
            <Suspense fallback={<DataTableSkeleton rows={8} columns={5} />}>
                <AuditLogsListView />
            </Suspense>
        </div>
    );
}
