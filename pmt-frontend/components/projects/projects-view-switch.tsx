'use client';

import {
    Calendar03Icon,
    KanbanIcon,
    ListViewIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { Button } from '@/components/ui/button';

/**
 * List, board or timeline. The same projects, the same filters, three readings.
 *
 * The choice lives in the URL (`?view=board`) rather than in state, so a link to
 * "the board, filtered to critical work" is a link somebody can send.
 */

export const PROJECT_VIEWS = [
    { value: 'list', label: 'List', icon: ListViewIcon },
    { value: 'board', label: 'Board', icon: KanbanIcon },
    { value: 'timeline', label: 'Timeline', icon: Calendar03Icon },
] as const;

export type ProjectView = (typeof PROJECT_VIEWS)[number]['value'];

/**
 * Read a view out of the URL, falling back to the list.
 *
 * An unknown value is a typo or a stale link, and the list is the reading that
 * always makes sense, so it is what a bad value resolves to rather than an
 * error.
 */
export function parseProjectView(value: string | undefined): ProjectView {
    return PROJECT_VIEWS.some((view) => view.value === value)
        ? (value as ProjectView)
        : 'list';
}

export function ProjectsViewSwitch({
    view,
    onChange,
}: {
    view: ProjectView;
    onChange: (view: ProjectView) => void;
}) {
    return (
        <div
            className='flex items-center gap-0.5 rounded-lg border border-line bg-surface-raised p-0.5'
            role='group'
            aria-label='Project view'>
            {PROJECT_VIEWS.map((option) => (
                <Button
                    key={option.value}
                    type='button'
                    size='sm'
                    variant={option.value === view ? 'default' : 'ghost'}
                    aria-pressed={option.value === view}
                    onClick={() => onChange(option.value)}
                    className='h-8 gap-1.5 px-3 text-xs'>
                    <HugeiconsIcon
                        icon={option.icon}
                        className='size-4'
                        strokeWidth={1.75}
                    />
                    {option.label}
                </Button>
            ))}
        </div>
    );
}
