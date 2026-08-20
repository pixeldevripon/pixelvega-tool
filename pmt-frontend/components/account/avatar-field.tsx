'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
    CloudUploadIcon,
    Delete02Icon,
    Image01Icon,
    Loading03Icon,
} from '@hugeicons/core-free-icons';
import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    useRemoveProfilePhoto,
    useUpdateProfilePhoto,
} from '@/hooks/profile/use-profile';
import type { UserProfile } from '@/types/profile';

// Loaded on demand: the cropper pulls in react-easy-crop, which nobody who is
// not changing their photo should pay for.
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
 * Avatar, upload and remove.
 *
 * `maxSizeMb` is a prop rather than a literal, and it comes from
 * `GET /profiles/options`, which reads the same constant multer enforces. The
 * version this replaced said "up to 5MB" in copy while checking a different
 * number in code, which is how a user gets told their 4MB photo is too large.
 *
 * The check here is a courtesy that saves an upload; multer refuses regardless.
 */
export function AvatarField({
    user,
    maxSizeMb,
    disabled,
}: {
    user: UserProfile;
    maxSizeMb: number;
    disabled?: boolean;
}) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [openCropper, setOpenCropper] = useState(false);
    const [pendingImage, setPendingImage] = useState('');
    const updatePhoto = useUpdateProfilePhoto();
    const removePhoto = useRemoveProfilePhoto();

    const busy = updatePhoto.isPending || removePhoto.isPending;

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        // Cleared immediately so choosing the SAME file twice still fires a
        // change event, which is the case a user hits after cancelling a crop.
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (!file) return;

        if (file.size > maxSizeMb * 1024 * 1024) {
            toast.error(`That image is too large. The limit is ${maxSizeMb}MB.`);
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setPendingImage(reader.result as string);
            setOpenCropper(true);
        };
        reader.readAsDataURL(file);
    };

    const handleCropComplete = (file: File) => {
        setOpenCropper(false);
        updatePhoto.mutate(file, {
            onSuccess: () => toast.success('Profile photo updated'),
        });
    };

    return (
        <div className='space-y-3'>
            <Label id='avatar-label'>Your Avatar</Label>
            <div
                role='group'
                aria-labelledby='avatar-label'
                className='flex flex-wrap items-center gap-4'>
                <Avatar className='size-16 shrink-0 border border-dashed border-line'>
                    {user.avatarUrl ? (
                        <AvatarImage
                            src={user.avatarUrl}
                            alt=''
                            className='object-cover'
                        />
                    ) : null}
                    <AvatarFallback className='bg-transparent text-content-subtle'>
                        <HugeiconsIcon icon={Image01Icon} className='size-5' />
                    </AvatarFallback>
                </Avatar>

                <Button
                    type='button'
                    variant='outline'
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy || disabled}>
                    <HugeiconsIcon
                        icon={busy ? Loading03Icon : CloudUploadIcon}
                        className={busy ? 'size-4 animate-spin' : 'size-4'}
                    />
                    Upload avatar
                </Button>

                {user.avatarUrl ? (
                    <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        aria-label='Remove avatar'
                        onClick={() =>
                            removePhoto.mutate(undefined, {
                                onSuccess: () =>
                                    toast.success('Profile photo removed'),
                            })
                        }
                        disabled={busy || disabled}
                        className='text-danger-fg hover:text-danger-fg'>
                        <HugeiconsIcon
                            icon={Delete02Icon}
                            className='size-4'
                        />
                    </Button>
                ) : null}

                <input
                    type='file'
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept='image/*'
                    className='hidden'
                    aria-label='Choose a profile photo'
                />
            </div>
            <p className='text-sm text-content-muted'>
                Pick a photo up to {maxSizeMb}MB.
            </p>

            {openCropper ? (
                <ImageCropper
                    open={openCropper}
                    imageSrc={pendingImage}
                    onClose={() => setOpenCropper(false)}
                    onCropComplete={handleCropComplete}
                />
            ) : null}
        </div>
    );
}
