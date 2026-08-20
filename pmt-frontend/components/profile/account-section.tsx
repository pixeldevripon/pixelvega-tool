'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { CloudUploadIcon, Loading03Icon } from '@hugeicons/core-free-icons';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    useUpdateProfile,
    useRemoveProfilePhoto,
    useUpdateProfilePhoto,
} from '@/hooks/profile/use-profile';
import {
    profileSchema,
    type ProfileFormValues,
} from '@/lib/validations/profile';
import type { UserProfile } from '@/types/profile';
import { formatDate } from '@/utils/intl-utils';
import { zodResolver } from '@hookform/resolvers/zod';
import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { EnumBadge } from '@/components/common/enum-badge';
import {
    ProfileSaveButton,
    ProfileSection,
    ProfileTextField,
} from './profile-section';

// bundle-dynamic-imports: Load heavy cropper only when needed
const ImageCropper = dynamic(() => import('./image-cropper'), {
    loading: () => (
        <HugeiconsIcon
            icon={Loading03Icon}
            className='mx-auto my-8 size-10 animate-spin text-primary'
        />
    ),
    ssr: false,
});

/**
 * The Account section (Webflow-settings style): flat blocks divided by
 * hairlines - Avatar, Account info (name + email), Account details rows.
 * Save sits in the block header, enabled only while the form is dirty.
 */
export function AccountSection({ user }: { user: UserProfile }) {
    return (
        <div>
            <AvatarBlock user={user} />
            <AccountInfoBlock user={user} />
            <AccountDetailsBlock user={user} />
        </div>
    );
}

/* ── Avatar ─────────────────────────────────────────────────────────────── */

function AvatarBlock({ user }: { user: UserProfile }) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [openCropper, setOpenCropper] = useState(false);
    const [tempImageSrc, setTempImageSrc] = useState<string>('');
    const updatePhoto = useUpdateProfilePhoto();
    const removePhoto = useRemoveProfilePhoto();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast.error('File too large. Max size is 5MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setTempImageSrc(reader.result as string);
            setOpenCropper(true);
        };
        reader.readAsDataURL(file);

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleCropComplete = async (file: File) => {
        setOpenCropper(false);
        setUploading(true);
        try {
            // The reference uploaded to its media library first and then saved
            // the returned URL. PMT has ONE uploader, on the backend:
            // POST /profiles/me/avatar takes the file itself and returns the
            // stored profile, so there is no two-step and no URL to pass.
            await updatePhoto.mutateAsync(file);
            toast.success('Profile photo updated');
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : 'Failed to upload image',
            );
        } finally {
            setUploading(false);
        }
    };

    const handleRemovePhoto = async () => {
        setUploading(true);
        try {
            await removePhoto.mutateAsync();
            toast.success('Profile photo removed');
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : 'Failed to remove photo',
            );
        } finally {
            setUploading(false);
        }
    };

    return (
        <ProfileSection title='Avatar'>
            <div className='mt-6 flex items-start gap-4'>
                <Avatar className='size-14 shrink-0 ring-1 ring-line'>
                    {user.avatarUrl ? (
                        <AvatarImage
                            src={user.avatarUrl}
                            className='object-cover'
                        />
                    ) : null}
                    <AvatarFallback className='bg-muted text-lg'>
                        {user.name?.charAt(0) || 'U'}
                    </AvatarFallback>
                </Avatar>
                <div className='min-w-0'>
                    <div className='flex flex-wrap items-center gap-2'>
                        <Button
                            size='sm'
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}>
                            <HugeiconsIcon
                                icon={
                                    uploading ? Loading03Icon : CloudUploadIcon
                                }
                                className={
                                    uploading ? 'size-4 animate-spin' : 'size-4'
                                }
                            />
                            Upload
                        </Button>
                        {user.avatarUrl ? (
                            <Button
                                variant='ghost'
                                size='sm'
                                onClick={handleRemovePhoto}
                                disabled={uploading}
                                className='text-muted-foreground hover:text-destructive'>
                                Remove
                            </Button>
                        ) : null}
                    </div>
                    <p className='mt-2.5 max-w-sm text-sm text-muted-foreground'>
                        Upload an image up to 5MB. Your avatar shows up across
                        the dashboard and in team notifications.
                    </p>
                </div>
                <input
                    type='file'
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept='image/*'
                    className='hidden'
                    aria-label='Upload profile photo'
                />
            </div>

            {openCropper ? (
                <ImageCropper
                    open={openCropper}
                    imageSrc={tempImageSrc}
                    onClose={() => setOpenCropper(false)}
                    onCropComplete={handleCropComplete}
                />
            ) : null}
        </ProfileSection>
    );
}

/* ── Account info (name + email) ────────────────────────────────────────── */

function AccountInfoBlock({ user }: { user: UserProfile }) {
    const updateMutation = useUpdateProfile();

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isDirty },
    } = useForm<ProfileFormValues>({
        resolver: zodResolver(profileSchema),
        defaultValues: { name: user.name ?? '' },
    });

    const onSave = handleSubmit(data => {
        updateMutation.mutate(data, {
            onSuccess: () => {
                toast.success('Profile updated');
                reset(data);
            },
        });
    });

    return (
        <ProfileSection
            title='Account info'
            description='Displayed on your account, emails and notifications.'
            action={
                <ProfileSaveButton
                    onClick={onSave}
                    disabled={!isDirty}
                    isPending={updateMutation.isPending}
                />
            }>
            <form onSubmit={onSave} className='mt-6 max-w-xl space-y-6'>
                <ProfileTextField
                    label='Full name'
                    registration={register('name')}
                    error={errors.name?.message}
                />

                {/* Email changes go through the verified Better Auth
                    change-email flow (dialog) - never a profile save. The
                    address renders as a calm field-shaped row with the
                    action inline, not as a disabled input + detached button. */}
                {/* Read-only, deliberately. An email is the account identity
                    here: it is what an invite was sent to and what the audit
                    log records. `PATCH /profiles/me` does not accept it, and a
                    self-service change would need a verified two-inbox flow
                    this API does not expose. An administrator changes it
                    through `PATCH /users/:userId`. */}
                <div className='space-y-2'>
                    <Label id='email-label'>Email</Label>
                    <div
                        aria-labelledby='email-label'
                        className='flex items-center gap-3 rounded-md border border-input bg-muted/30 px-3 py-2'>
                        <span className='truncate text-sm'>{user.email}</span>
                    </div>
                    <p className='text-xs text-muted-foreground'>
                        Ask an administrator to change the email on your
                        account.
                    </p>
                </div>
            </form>
        </ProfileSection>
    );
}

/* ── Account details ────────────────────────────────────────────────────── */

function AccountDetailsBlock({ user }: { user: UserProfile }) {
    const rows: { label: string; value: React.ReactNode }[] = [
        {
            label: 'Account created',
            value: user.createdAt
                ? formatDate(user.createdAt, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                  })
                : '-',
        },
        {
            label: 'Role',
            // The API sends the label already written ("Project Manager"), so
            // there is nothing to case-convert. The version this replaced did
            // `role.toLowerCase().replace('_', ' ')`, which is presentation
            // logic the backend now owns (D4) and which produced "project
            // manager" where the API says "Project Manager".
            value: <span>{user.role.label}</span>,
        },
        {
            label: 'Account status',
            // Replaces an "Email verification" row reading a field this API does
            // not send. Status is the one that matters here: INVITED means the
            // temporary password has not been replaced yet, and SUSPENDED means
            // the account cannot sign in.
            value: (
                <EnumBadge display={user.status} />
            ),
        },
    ];

    return (
        <ProfileSection title='Account details'>
            <dl className='mt-4'>
                {rows.map(row => (
                    <div
                        key={row.label}
                        className='flex items-center gap-4 border-b border-line py-3 text-sm'>
                        <dt className='w-44 shrink-0 text-muted-foreground sm:w-56'>
                            {row.label}
                        </dt>
                        <dd className='min-w-0'>{row.value}</dd>
                    </div>
                ))}
            </dl>
        </ProfileSection>
    );
}
