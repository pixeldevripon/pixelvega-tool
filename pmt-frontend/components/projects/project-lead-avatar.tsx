'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { ProjectMemberSummary } from '@/types/projects';

/** A person, or the absence of one. Shared by all three project views. */
export function ProjectLeadAvatar({
    person,
    className,
}: {
    person: ProjectMemberSummary | null;
    className?: string;
}) {
    return (
        <Avatar
            className={cn('size-6 shrink-0', className)}
            title={person?.name ?? 'No lead'}>
            {person?.avatarUrl && <AvatarImage src={person.avatarUrl} alt='' />}
            <AvatarFallback className='text-2xs'>
                {person ? person.name.slice(0, 2).toUpperCase() : '—'}
            </AvatarFallback>
        </Avatar>
    );
}

/**
 * The team stack moved to `components/common/member-stack.tsx` when the overview
 * needed the same one. Re-exported under its original name so the three project
 * views keep reading the way they did.
 */
export { MemberStack as ProjectMemberStack } from '@/components/common/member-stack';
