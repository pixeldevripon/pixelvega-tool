'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Delete02Icon, Loading03Icon } from '@hugeicons/core-free-icons';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDeleteAccount } from '@/hooks/profile/use-profile';

/**
 * Delete your own account, behind a typed confirmation.
 *
 * ── Typing the email is a pause, not a security control ──
 *
 * The session already proves who is asking, and anyone who reaches this dialog
 * knows their own address. What it buys is the half-second between "I am
 * annoyed" and an action with no undo, in the one place a misclick would
 * otherwise be enough. The API checks it too, which catches the case a dialog
 * cannot: a request built against the wrong account.
 *
 * ── What actually happens, said plainly ──
 *
 * The row is soft deleted, so the work history stays intact for whoever picks
 * it up. Saying "removes all your data" when it does not would be a lie people
 * make decisions on. Every session is destroyed, which is why this ends at the
 * sign-in screen rather than back on the account page.
 */
export function DeleteAccountDialog({
    open,
    onOpenChange,
    email,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    email: string;
}) {
    const router = useRouter();
    const [confirmation, setConfirmation] = useState('');
    const deleteAccount = useDeleteAccount();

    const matches = confirmation.trim().toLowerCase() === email.toLowerCase();

    const onConfirm = () => {
        deleteAccount.mutate(confirmation, {
            onSuccess: () => {
                toast.success('Your account has been deleted.');
                // `replace`, not `push`: Back must not return to a dashboard
                // rendered for an account that no longer exists.
                router.replace('/login');
            },
            onError: (error: Error) =>
                toast.error(error.message || 'Could not delete the account'),
        });
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                // Cleared on close so reopening does not present a dialog whose
                // confirm button is already armed.
                if (!next) setConfirmation('');
                onOpenChange(next);
            }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete account</DialogTitle>
                    <DialogDescription>
                        This signs you out everywhere and closes your account.
                        Work you have already logged stays on the projects it
                        belongs to. An administrator has to invite you again to
                        restore access.
                    </DialogDescription>
                </DialogHeader>

                <div className='space-y-2'>
                    <Label htmlFor='delete-account-confirmation'>
                        Type <span className='font-medium'>{email}</span> to
                        confirm
                    </Label>
                    <Input
                        id='delete-account-confirmation'
                        value={confirmation}
                        autoComplete='off'
                        onChange={(event) =>
                            setConfirmation(event.target.value)
                        }
                    />
                </div>

                <DialogFooter>
                    <Button
                        type='button'
                        variant='outline'
                        onClick={() => onOpenChange(false)}
                        disabled={deleteAccount.isPending}>
                        Cancel
                    </Button>
                    <Button
                        type='button'
                        variant='destructive'
                        onClick={onConfirm}
                        disabled={!matches || deleteAccount.isPending}>
                        {deleteAccount.isPending ? (
                            <HugeiconsIcon
                                icon={Loading03Icon}
                                className='size-4 animate-spin'
                            />
                        ) : (
                            <HugeiconsIcon
                                icon={Delete02Icon}
                                className='size-4'
                            />
                        )}
                        Delete account
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
