'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { HugeiconsIcon } from '@hugeicons/react';
import { Mail01Icon } from '@hugeicons/core-free-icons';
import { useMutation } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';

import { SecretField } from '@/components/common/settings-fields';
import { authClient } from '@/lib/auth-client';
import {
    buildChangePasswordSchema,
    metPasswordRules,
    type ChangePasswordValues,
} from '@/lib/validations/profile';
import type { PasswordPolicy, UserProfile } from '@/types/profile';

import {
    AccountSection,
    AccountSectionActions,
    ReadOnlyField,
    SaveButton,
} from './account-section';
import { PasswordRequirements } from './password-requirements';

/**
 * Email (read only) and change password.
 *
 * ── One password flow, not two ──
 *
 * Every account here has a credential: `UsersService.invite()` creates one
 * through better-auth's sign-up with a generated password nobody is told, so
 * there is no "set a first password" state to branch on.
 *
 * ── Change requires the CURRENT password, and that is the protection ──
 *
 * `POST /api/auth/change-password` is one call, with no emailed confirmation
 * step. The current-password requirement is what an email round trip would have
 * been standing in for: it stops someone who has walked up to an unlocked laptop
 * from taking the account, because they would still have to know the old one.
 *
 * ── Other sessions are revoked, and the form says so first ──
 *
 * Someone who changes their password on a laptop and silently loses their phone
 * session reads it as a bug rather than as the security measure it is.
 */
export function EmailPasswordSection({
    user,
    policy,
}: {
    user: UserProfile;
    policy: PasswordPolicy;
}) {
    // Rebuilt only when the served policy changes, which is once per session.
    const schema = useMemo(() => buildChangePasswordSchema(policy), [policy]);

    const form = useForm<ChangePasswordValues>({
        resolver: zodResolver(schema),
        // The checklist has to tick as someone types, not when they blur or
        // submit, which is the whole reason it is there.
        mode: 'onChange',
        defaultValues: { currentPassword: '', newPassword: '' },
    });

    const newPassword = useWatch({
        control: form.control,
        name: 'newPassword',
    });
    const met = useMemo(
        () => metPasswordRules(policy, newPassword ?? ''),
        [policy, newPassword],
    );

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
            if (message.includes('invalid') || message.includes('incorrect')) {
                form.setError('currentPassword', {
                    message: 'That does not match your current password.',
                });
                return;
            }
            toast.error(error.message);
        },
    });

    return (
        <AccountSection
            title='Email & Password'
            description='Manage your email and password settings.'>
            <form
                onSubmit={form.handleSubmit((values) =>
                    changePassword.mutate(values),
                )}
                className='space-y-6'>
                {/* Read-only, deliberately. An email is the account identity
                    here: it is what an invite was sent to and what the audit log
                    records, and a self-service change would need a verified
                    two-inbox flow this API does not expose. The API says so
                    itself through `canChangeEmail`, which is always false, so
                    this is not a rule restated in a browser. */}
                <ReadOnlyField
                    label='Email'
                    value={user.email}
                    hint={
                        user.capabilities.canChangeEmail
                            ? undefined
                            : 'Ask an administrator to change the email on your account.'
                    }
                    trailing={
                        <HugeiconsIcon
                            icon={Mail01Icon}
                            className='size-4 shrink-0 text-content-subtle'
                            aria-hidden='true'
                        />
                    }
                />

                <SecretField
                    label='Current Password'
                    placeholder='Password'
                    autoComplete='current-password'
                    registration={form.register('currentPassword')}
                    error={form.formState.errors.currentPassword?.message}
                />

                <div className='space-y-4'>
                    <SecretField
                        label='New Password'
                        placeholder='Password'
                        autoComplete='new-password'
                        registration={form.register('newPassword')}
                        // No `error` here on purpose. The checklist below IS the
                        // error display for this field, and a red sentence
                        // repeating one of five ticks would be noise.
                    />
                    <PasswordRequirements
                        policy={policy}
                        met={met}
                        value={newPassword ?? ''}
                    />
                </div>

                <p className='text-xs text-content-muted'>
                    Changing your password signs out your other devices.
                </p>

                <AccountSectionActions>
                    <SaveButton
                        type='submit'
                        disabled={
                            changePassword.isPending ||
                            met.size < policy.rules.length ||
                            !form.formState.isDirty
                        }
                        isPending={changePassword.isPending}
                    />
                </AccountSectionActions>
            </form>
        </AccountSection>
    );
}
