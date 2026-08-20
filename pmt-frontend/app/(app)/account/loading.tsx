import { AccountSkeleton } from '@/components/skeletons/account-skeleton';

/** Suspense boundary for this segment. Reuses the view's own skeleton. */
export default function AccountLoading() {
    return <AccountSkeleton />;
}
