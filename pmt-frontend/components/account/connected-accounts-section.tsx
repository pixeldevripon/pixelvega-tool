'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, Loading03Icon } from '@hugeicons/core-free-icons';
import { toast } from 'sonner';

import { toneToVariant } from '@/components/common/enum-badge';
import { statusDot } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { useDisconnectAccount } from '@/hooks/profile/use-profile';
import { cn } from '@/lib/utils';
import type { ConnectedAccount, UserProfile } from '@/types/profile';

import { AccountSection } from './account-section';

/**
 * What is linked to this account, as the chip row from the reference design.
 *
 * ── The list is real, and it is short ──
 *
 * The reference shows Google and Slack with an "Add App" button. This product
 * configures no OAuth providers, so there is nothing to add and no button to
 * add it with. What it does have is the credential every account is created
 * with and, for staff, a cached Slack member id, and the API returns both in one
 * list so a screen does not have to know they come from different tables.
 *
 * ── The dismiss control is gated on the server's flag, not on the label ──
 *
 * `canDisconnect` is false for the email and password credential: it is the only
 * way into the account, and a settings screen that can lock someone out of their
 * own account is a defect rather than a feature. The API refuses it too, so
 * hiding the control is a courtesy rather than the control itself.
 */
export function ConnectedAccountsSection({ user }: { user: UserProfile }) {
    return (
        <AccountSection
            title='Connect Accounts'
            description='Manage your connected accounts.'>
            {user.connectedAccounts.length === 0 ? (
                <p className='text-sm text-content-muted'>
                    Nothing is connected to this account yet.
                </p>
            ) : (
                <div className='flex flex-wrap gap-2'>
                    {user.connectedAccounts.map((connection) => (
                        <ConnectionChip
                            key={connection.provider.value}
                            connection={connection}
                        />
                    ))}
                </div>
            )}
            <p className='mt-4 text-sm text-content-muted'>
                Connected accounts let PixelVega reach third-party services on
                your behalf, such as posting your project updates to Slack.
            </p>
        </AccountSection>
    );
}

function ConnectionChip({ connection }: { connection: ConnectedAccount }) {
    const disconnect = useDisconnectAccount();

    return (
        <span className='inline-flex items-center gap-2 rounded-md border border-line bg-surface-raised py-1.5 pl-3 pr-1.5 text-sm'>
            {/* The dot carries the API's tone, which is the one place a
                connection's importance is decided. The credential tones
                `primary` because in a row of chips it is the one that must not
                read as optional. */}
            <span
                aria-hidden='true'
                className={cn(
                    'size-2 shrink-0 rounded-full',
                    statusDot[toneToVariant(connection.provider.tone)],
                )}
            />
            <span className='font-medium'>{connection.provider.label}</span>
            {connection.detail ? (
                <span className='text-content-muted'>{connection.detail}</span>
            ) : null}

            {connection.canDisconnect ? (
                <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='size-6'
                    aria-label={`Disconnect ${connection.provider.label}`}
                    disabled={disconnect.isPending}
                    onClick={() =>
                        disconnect.mutate(connection.provider.value, {
                            onSuccess: () =>
                                toast.success(
                                    `${connection.provider.label} disconnected`,
                                ),
                        })
                    }>
                    <HugeiconsIcon
                        icon={
                            disconnect.isPending ? Loading03Icon : Cancel01Icon
                        }
                        className={cn(
                            'size-3.5',
                            disconnect.isPending && 'animate-spin',
                        )}
                    />
                </Button>
            ) : (
                // A dimmed cross would invite a click that does nothing.
                // Saying why is shorter than explaining a dead control.
                <span className='pr-1.5 text-xs text-content-subtle'>
                    Required
                </span>
            )}
        </span>
    );
}
