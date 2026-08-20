'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Delete02Icon } from '@hugeicons/core-free-icons';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { UserProfile } from '@/types/profile';

import { AccountSection } from './account-section';
import { DeleteAccountDialog } from './delete-account-dialog';

/**
 * Closing the account.
 *
 * ── The button is gated on the API's flag, and the refusal is explained ──
 *
 * `canDeleteAccount` is false for the SYSTEM_ADMIN, because there must always be
 * a root account and nothing in the API creates a second. That is a rule about
 * one row rather than about a role's capabilities, so it cannot live in the
 * permission gate, and the flag is how the screen learns it. It is rendered
 * disabled with the reason rather than hidden: a Danger Zone that silently
 * vanishes for one account looks like a rendering bug to the person it vanished
 * for.
 *
 * ── The copy says what actually happens ──
 *
 * A soft delete, so work history survives on the projects it belongs to. The
 * reference's "will remove all your data" would be a lie people make decisions
 * on.
 */
export function DangerZoneSection({ user }: { user: UserProfile }) {
    const [open, setOpen] = useState(false);
    const canDelete = user.capabilities.canDeleteAccount;

    return (
        <AccountSection
            title='Danger Zone'
            description='Closing your account signs you out everywhere and revokes your access. Work you have already logged stays on the projects it belongs to.'>
            <div className='flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line p-4'>
                {/* `flex-1` so the text shares the row rather than claiming all
                    of it and pushing the button onto a line of its own. */}
                <div className='min-w-0 flex-1'>
                    <p className='text-sm font-medium'>Delete account</p>
                    <p className='mt-1 text-sm text-content-muted'>
                        {canDelete
                            ? 'You will be signed out of every device immediately. An administrator has to invite you again to restore access.'
                            : 'The system admin account cannot be deleted. There must always be a root account for this workspace.'}
                    </p>
                </div>
                <Button
                    type='button'
                    variant='outline'
                    disabled={!canDelete}
                    onClick={() => setOpen(true)}
                    className='shrink-0 border-danger-border text-danger-fg hover:bg-danger-subtle hover:text-danger-fg'>
                    <HugeiconsIcon icon={Delete02Icon} className='size-4' />
                    Delete
                </Button>
            </div>

            {canDelete ? (
                <DeleteAccountDialog
                    open={open}
                    onOpenChange={setOpen}
                    email={user.email}
                />
            ) : null}
        </AccountSection>
    );
}
