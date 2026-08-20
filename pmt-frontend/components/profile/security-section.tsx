'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { SecretField } from '@/components/common/settings-fields';
import { authClient } from '@/lib/auth-client';
import {
    changePasswordSchema,
    type ChangePasswordValues,
} from '@/lib/validations/profile';

import { ProfileSaveButton, ProfileSection } from './profile-section';

/**
 * Change your password.
 *
 * ── One flow, not two ──
 *
 * The version this replaced branched on `hasPassword` and offered a
 * "set a password" variant for accounts that never had one. Every account here
 * has one: `UsersService.invite()` creates it through better-auth's sign-up
 * with a generated temporary password, so there is no credential-less state to
 * handle. The branch was dead code that could only ever show its wrong half.
 *
 * ── It also replaced an emailed confirmation step ──
 *
 * That flow posted to `/users/me/password-change/request` and `/confirm`, which
 * do not exist on this API. Password change here is a single call to
 * `POST /api/auth/change-password`, which requires the CURRENT password. That
 * requirement is the protection an email round trip was standing in for: it
 * stops someone who has walked up to an unlocked laptop from taking the
 * account, because they would still have to know the old password.
 *
 * ── Other sessions are revoked ──
 *
 * `revokeOtherSessions: true`, and the form says so before it happens. Someone
 * who changes their password on a laptop and silently loses their phone session
 * will read it as a bug rather than as the security measure it is.
 */
export function SecuritySection() {
    const form = useForm<ChangePasswordValues>({
        resolver: zodResolver(changePasswordSchema),
        defaultValues: { currentPassword: '', newPassword: '' },
    });

    const changePassword = useMutation({
        mutationFn: async (values: ChangePasswordValues) => {
            const { error } = await authClient.changePassword({
                currentPassword: values.currentPassword,
                newPassword: values.newPassword,
                revokeOtherSessions: true,
            });
            if (error) {
                throw new Error(
                    error.message ?? 'That password could not be saved.',
                );
            }
        },
        onSuccess: () => {
            toast.success('Password updated. Other sessions were signed out.');
            form.reset();
        },
        onError: (error: Error) => {
            // `setError` on the field rather than only a toast: the overwhelming
            // cause is a mistyped current password, and the message belongs next
            // to the input it is about.
            const message = error.message.toLowerCase();
            if (
                message.includes('invalid') ||
                message.includes('incorrect') ||
                message.includes('password')
            ) {
                form.setError('currentPassword', {
                    message: 'That does not match your current password.',
                });
                return;
            }
            toast.error(error.message);
        },
    });

    return (
        <ProfileSection
            title='Password'
            description='Changing it signs out your other sessions.'>
            <form
                onSubmit={form.handleSubmit((values) =>
                    changePassword.mutate(values),
                )}
                className='mt-6 max-w-md space-y-6'>
                <SecretField
                    label='Current password'
                    registration={form.register('currentPassword')}
                    error={form.formState.errors.currentPassword?.message}
                    autoComplete='current-password'
                />
                <SecretField
                    label='New password'
                    registration={form.register('newPassword')}
                    error={form.formState.errors.newPassword?.message}
                    autoComplete='new-password'
                />

                <ProfileSaveButton
                    type='submit'
                    variant='default'
                    disabled={
                        changePassword.isPending || !form.formState.isDirty
                    }
                    isPending={changePassword.isPending}
                    label='Update password'
                />
            </form>
        </ProfileSection>
    );
}
