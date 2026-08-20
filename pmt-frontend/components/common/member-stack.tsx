'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

/**
 * The stacked faces a row or card shows for its team.
 *
 * ── Typed structurally, on purpose ──
 *
 * `ProjectMemberSummary` and `DashboardMember` are the same four fields from two
 * endpoints, and this component reads all four and nothing else. Declaring the
 * shape it needs rather than importing either type is what lets the projects
 * screens and the overview share one stack: `components/<module>/` may not
 * import another module's folder, so a component both need lives here.
 */
export type StackedMember = {
    id: string;
    name: string;
    avatarUrl: string | null;
    /** Their role on THIS project, not their account role. */
    projectRole: { label: string };
};

export function MemberStack({
    members,
    max = 4,
    emptyLabel = 'Nobody staffed',
}: {
    members: StackedMember[];
    /** Beyond four faces a row stops reading, so the rest become a "+N" chip. */
    max?: number;
    emptyLabel?: string;
}) {
    const overflow = members.length - max;

    // An empty team is worth saying out loud rather than leaving a gap: an
    // unstaffed project is the thing a staffing decision is looking for.
    if (members.length === 0) {
        return (
            <span className='text-2xs font-medium text-warning-fg'>
                {emptyLabel}
            </span>
        );
    }

    return (
        // `pr-1` leaves room for the last avatar's ring, which is drawn OUTSIDE
        // the box: without it, a parent that clips its overflow shaves a sliver
        // off the rightmost face.
        <div className='flex items-center pr-1'>
            {members.slice(0, max).map((member) => (
                <Avatar
                    key={member.id}
                    // Overlapped, with a ring so they stay distinct against
                    // whatever the card's surface is. `size-7` rather than
                    // `size-6`: at 24px the overlap and the ring together cover
                    // enough of each photo that faces read as cropped.
                    className='-mr-2 size-7 ring-2 ring-surface-overlay'
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
                <span className='ml-3 text-2xs font-medium tabular-nums text-content-subtle'>
                    +{overflow}
                </span>
            )}
        </div>
    );
}
