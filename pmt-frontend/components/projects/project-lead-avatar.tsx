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

/** The stacked faces a row or card shows for its team. */
export function ProjectMemberStack({
    members,
    max = 4,
}: {
    members: ProjectMemberSummary[];
    max?: number;
}) {
    const overflow = members.length - max;

    if (members.length === 0) {
        return (
            <span className='text-2xs font-medium text-warning-fg'>
                Nobody staffed
            </span>
        );
    }

    return (
        <div className='flex items-center'>
            {members.slice(0, max).map((member) => (
                <Avatar
                    key={member.id}
                    className='-mr-1.5 size-6 ring-2 ring-surface-overlay'
                    title={`${member.name} · ${member.projectRole.label}`}>
                    {member.avatarUrl && (
                        <AvatarImage src={member.avatarUrl} alt='' />
                    )}
                    <AvatarFallback className='text-2xs'>
                        {member.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
            ))}
            {overflow > 0 && (
                <span className='ml-2.5 text-2xs font-medium text-content-subtle'>
                    +{overflow}
                </span>
            )}
        </div>
    );
}
