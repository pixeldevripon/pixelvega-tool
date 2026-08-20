import type { Metadata } from 'next';
import { Suspense } from 'react';

import { DataTableSkeleton } from '@/components/data-table/data-table-skeleton';
import { ProjectsView } from '@/components/projects/projects-view';

export const metadata: Metadata = { title: 'Projects' };

/**
 * A Server Component: the title and the view, nothing else. Every piece of list
 * state lives in the URL and every row comes from a client query, so this never
 * re-renders on a filter change.
 *
 * The boundary is required rather than decorative. `useTableState` reads
 * `useSearchParams`, and under `cacheComponents` a component that reads the
 * request outside a `<Suspense>` fails the build instead of quietly making the
 * whole page dynamic.
 */
export default function ProjectsPage() {
    return (
        <div className='flex flex-col gap-4'>
            <div>
                <h1 className='text-2xl font-medium'>Projects</h1>
                <p className='mt-1 text-sm text-content-muted'>
                    List, board and timeline, grouped by the manager carrying
                    the work
                </p>
            </div>
            <Suspense fallback={<DataTableSkeleton rows={8} columns={6} />}>
                <ProjectsView />
            </Suspense>
        </div>
    );
}
