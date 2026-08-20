'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

/**
 * A person in a table cell: face, name, and a second line.
 *
 * Shared because five list screens show a person the same way, and a table where
 * the requester column looks different from the reviewer column reads as two
 * unrelated tables.
 *
 * `null` renders the em dash rather than an empty cell, so an absent person is
 * visibly absent instead of looking like a rendering failure.
 */
export function PersonCell({
    name,
    secondary,
    avatarUrl,
}: {
    name: string | null | undefined;
    /** Email, role label, or whatever identifies them on this screen. */
    secondary?: string | null;
    avatarUrl?: string | null;
}) {
    if (!name) {
        return <span className='text-content-subtle'>—</span>;
    }

    return (
        <div className='flex items-center gap-2'>
            <Avatar className='size-7 shrink-0'>
                {avatarUrl && <AvatarImage src={avatarUrl} alt='' />}
                <AvatarFallback className='text-2xs'>
                    {name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
            </Avatar>
            <div className='min-w-0'>
                <p className='truncate text-sm text-content'>{name}</p>
                {secondary && (
                    <p className='truncate text-2xs text-content-muted'>
                        {secondary}
                    </p>
                )}
            </div>
        </div>
    );
}
