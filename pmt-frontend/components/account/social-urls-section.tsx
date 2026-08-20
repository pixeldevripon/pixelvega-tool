'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Delete02Icon } from '@hugeicons/core-free-icons';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUpdateProfile } from '@/hooks/profile/use-profile';
import {
    socialUrlsSchema,
    type SocialUrlsValues,
} from '@/lib/validations/profile';
import type { UserProfile } from '@/types/profile';

import {
    AccountSection,
    AccountSectionActions,
    SaveButton,
} from './account-section';

/**
 * A list of personal links, added and removed a row at a time.
 *
 * ── One PATCH, carrying the whole list ──
 *
 * `socialUrls` REPLACES what is stored, so there is no add endpoint, no delete
 * endpoint and no ordering call. The rows are the value.
 *
 * ── Empty rows are allowed while editing and stripped on save ──
 *
 * Someone who presses Add URL and then changes their mind must still be able to
 * save. Validating an untouched empty row would block the form on a field they
 * never filled in, which is the most common complaint about list editors.
 *
 * ── The maximum comes from the API ──
 *
 * `maxSocialUrls` is on `GET /profiles/options`, from the same constant the DTO
 * bounds the array with, so the Add button disables exactly when the server
 * would start refusing.
 */
export function SocialUrlsSection({
    user,
    maxUrls,
}: {
    user: UserProfile;
    maxUrls: number;
}) {
    const updateProfile = useUpdateProfile();

    const {
        control,
        register,
        handleSubmit,
        reset,
        formState: { errors, isDirty },
    } = useForm<SocialUrlsValues>({
        resolver: zodResolver(socialUrlsSchema),
        defaultValues: toFormValues(user, maxUrls),
    });

    const { fields, append, remove } = useFieldArray({ control, name: 'urls' });

    const onSave = handleSubmit((values) => {
        const socialUrls = values.urls
            .map((row) => row.value.trim())
            .filter((value) => value.length > 0);

        updateProfile.mutate(
            { socialUrls },
            {
                onSuccess: (profile) => {
                    toast.success('Social links saved');
                    reset(toFormValues(profile, maxUrls));
                },
            },
        );
    });

    const canEdit = user.capabilities.canEditProfile;

    return (
        <AccountSection
            title='Social URLs'
            description='Manage your social URLs.'>
            <form onSubmit={onSave} className='space-y-3'>
                {fields.map((field, index) => (
                    <div key={field.id} className='space-y-2'>
                        <div className='flex items-center gap-2'>
                            <Input
                                placeholder='Link to social profile'
                                inputMode='url'
                                disabled={!canEdit}
                                aria-label={`Social profile ${index + 1}`}
                                aria-invalid={!!errors.urls?.[index]?.value}
                                {...register(`urls.${index}.value`)}
                            />
                            <Button
                                type='button'
                                variant='ghost'
                                size='icon'
                                aria-label={`Remove social profile ${index + 1}`}
                                disabled={!canEdit}
                                onClick={() => remove(index)}
                                className='shrink-0 text-content-muted hover:text-danger-fg'>
                                <HugeiconsIcon
                                    icon={Delete02Icon}
                                    className='size-4'
                                />
                            </Button>
                        </div>
                        {errors.urls?.[index]?.value ? (
                            <p className='text-xs font-medium text-danger-fg'>
                                {errors.urls[index]?.value?.message}
                            </p>
                        ) : null}
                    </div>
                ))}

                <AccountSectionActions>
                    <Button
                        type='button'
                        variant='outline'
                        className='mr-auto'
                        disabled={!canEdit || fields.length >= maxUrls}
                        onClick={() => append({ value: '' })}>
                        <HugeiconsIcon icon={Add01Icon} className='size-4' />
                        Add URL
                    </Button>
                    <SaveButton
                        type='submit'
                        disabled={!isDirty || !canEdit}
                        isPending={updateProfile.isPending}
                    />
                </AccountSectionActions>

                {fields.length >= maxUrls ? (
                    <p className='text-xs text-content-muted'>
                        You can list up to {maxUrls} links.
                    </p>
                ) : null}
            </form>
        </AccountSection>
    );
}

/**
 * Always shows at least three rows, matching the reference.
 *
 * An empty list rendering as nothing but an Add button is a section that looks
 * broken. The extra rows are empty strings and are stripped on save, so padding
 * the form costs nothing on the way out.
 */
function toFormValues(user: UserProfile, maxUrls: number): SocialUrlsValues {
    const stored = user.socialUrls.map((value) => ({ value }));
    const minimumRows = Math.min(3, maxUrls);
    while (stored.length < minimumRows) {
        stored.push({ value: '' });
    }
    return { urls: stored };
}
