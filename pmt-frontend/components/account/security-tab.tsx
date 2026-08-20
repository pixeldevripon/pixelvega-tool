'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
    ComputerIcon,
    Loading03Icon,
    Logout01Icon,
} from '@hugeicons/core-free-icons';

import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    useProfileSessionsQuery,
    useRevokeOtherSessions,
    useRevokeSession,
} from '@/hooks/profile/use-profile-sessions';
import type { ProfileSession } from '@/types/profile';
import { formatDate } from '@/utils/intl-utils';

import { AccountSection } from './account-section';

/**
 * Where the caller is signed in, and how to end any of it.
 *
 * ── Reading a device list is the point, so the server names the devices ──
 *
 * `device` arrives as "Chrome on macOS", parsed from the user agent by the API.
 * That parsing is presentation logic two clients would get differently, and it
 * is the kind of code that quietly grows a dozen more browsers once it lives in
 * a component.
 *
 * ── The current session is marked and cannot be revoked from a row ──
 *
 * Signing yourself out is the sign-out button in the header. A Revoke that logs
 * you out of the page you are on reads as a bug, so the row carries
 * `capabilities.canRevoke: false` and the API refuses it as well.
 */
export function SecurityTab() {
    const { data: sessions, isLoading, isError } = useProfileSessionsQuery();
    const revokeOthers = useRevokeOtherSessions();

    const others = sessions?.filter((session) => !session.isCurrent) ?? [];

    return (
        <AccountSection
            title='Active sessions'
            description='The devices signed in to your account. If you do not recognise one, sign it out and change your password.'>
            {isLoading ? (
                <SessionListSkeleton />
            ) : isError ? (
                <p className='text-sm text-danger-fg'>
                    Your sessions could not be loaded. Try again in a moment.
                </p>
            ) : (
                <>
                    <ul className='divide-y divide-line rounded-lg border border-line'>
                        {sessions?.map((session) => (
                            <SessionRow key={session.id} session={session} />
                        ))}
                    </ul>

                    <div className='mt-6 flex justify-end'>
                        <Button
                            type='button'
                            variant='outline'
                            disabled={
                                others.length === 0 || revokeOthers.isPending
                            }
                            onClick={() => revokeOthers.mutate()}>
                            <HugeiconsIcon
                                icon={
                                    revokeOthers.isPending
                                        ? Loading03Icon
                                        : Logout01Icon
                                }
                                className={
                                    revokeOthers.isPending
                                        ? 'size-4 animate-spin'
                                        : 'size-4'
                                }
                            />
                            Sign out other devices
                        </Button>
                    </div>
                </>
            )}
        </AccountSection>
    );
}

function SessionRow({ session }: { session: ProfileSession }) {
    const revoke = useRevokeSession();

    return (
        <li className='flex flex-wrap items-center justify-between gap-3 p-4'>
            <div className='flex min-w-0 items-center gap-3'>
                <HugeiconsIcon
                    icon={ComputerIcon}
                    className='size-4 shrink-0 text-content-subtle'
                    aria-hidden='true'
                />
                <div className='min-w-0'>
                    <div className='flex flex-wrap items-center gap-2'>
                        <span className='truncate text-sm font-medium'>
                            {/* Null when the user agent could not be identified.
                                The server sends null rather than inventing a
                                label, so the wording for an absence is decided
                                here, once. */}
                            {session.device ?? 'Unrecognised device'}
                        </span>
                        {session.isCurrent ? (
                            <StatusBadge variant='success'>
                                This device
                            </StatusBadge>
                        ) : null}
                    </div>
                    <p className='mt-0.5 truncate text-xs text-content-muted'>
                        {session.ipAddress ?? 'Unknown address'} · Signed in{' '}
                        {formatDate(session.createdAt, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                        })}
                    </p>
                </div>
            </div>

            {session.capabilities.canRevoke ? (
                <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate(session.id)}
                    className='shrink-0 text-danger-fg hover:bg-danger-subtle hover:text-danger-fg'>
                    Sign out
                </Button>
            ) : null}
        </li>
    );
}

function SessionListSkeleton() {
    return (
        <div className='space-y-3 rounded-lg border border-line p-4'>
            {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className='flex items-center gap-3'>
                    <Skeleton className='size-4 rounded-full' />
                    <div className='flex-1 space-y-2'>
                        <Skeleton className='h-4 w-40' />
                        <Skeleton className='h-3 w-56' />
                    </div>
                </div>
            ))}
        </div>
    );
}
