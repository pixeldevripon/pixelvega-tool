import { Skeleton } from '@/components/ui/skeleton';

/**
 * Mirrors the account screen's layout: a tab row over sections laid out as a
 * description column beside a form column.
 *
 * It matches the real shape rather than being a generic block of grey, because
 * the point of a skeleton is that nothing jumps when the data lands.
 */
export function AccountSkeleton() {
    return (
        <div className='w-full max-w-5xl pb-16'>
            {/* Tab row: General, Security. */}
            <div className='flex gap-6 border-b border-line pb-3'>
                <Skeleton className='h-4 w-16' />
                <Skeleton className='h-4 w-16' />
            </div>

            {[0, 1, 2].map((section) => (
                <div
                    key={section}
                    className='grid gap-6 border-b border-line py-8 last:border-b-0 lg:grid-cols-3 lg:gap-12'>
                    <div className='space-y-2 lg:col-span-1'>
                        <Skeleton className='h-5 w-40' />
                        <Skeleton className='h-4 w-56' />
                    </div>
                    <div className='space-y-6 lg:col-span-2'>
                        {section === 0 ? (
                            <div className='flex items-center gap-4'>
                                <Skeleton className='size-16 shrink-0 rounded-full' />
                                <Skeleton className='h-9 w-36 rounded-md' />
                            </div>
                        ) : null}
                        <div className='grid gap-6 sm:grid-cols-2'>
                            {[0, 1, 2, 3].map((field) => (
                                <div key={field} className='space-y-2'>
                                    <Skeleton className='h-4 w-24' />
                                    <Skeleton className='h-9 w-full' />
                                </div>
                            ))}
                        </div>
                        <div className='flex justify-end'>
                            <Skeleton className='h-9 w-32 rounded-md' />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
