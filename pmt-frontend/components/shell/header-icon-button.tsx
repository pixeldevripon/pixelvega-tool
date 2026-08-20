'use client';

import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import type * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * The header's bare icon control: activity, notifications, theme.
 *
 * One component so the three cannot drift apart. They sit 8px from each other
 * in a dense row, where a 1px difference in size or a different hover reads as
 * a rendering bug rather than as three separate components.
 *
 * `label` is REQUIRED and becomes the accessible name. An icon-only control
 * with no name is unusable by a screen reader, and making it optional is how
 * one of the three ends up without it.
 *
 * Built on `Button` rather than a bare `<button>`: the focus ring, the disabled
 * treatment and the press translate are the product's, and a second
 * implementation of them would be a second thing to keep in step.
 */
export function HeaderIconButton({
    icon,
    label,
    /** Draws the small dot in the top right corner (unread, unseen, pending). */
    indicator = false,
    className,
    ...props
}: Omit<React.ComponentProps<typeof Button>, 'children' | 'aria-label'> & {
    icon: IconSvgElement;
    label: string;
    indicator?: boolean;
}) {
    return (
        <Button
            variant='ghost'
            size='icon-sm'
            aria-label={label}
            className={cn(
                'relative size-9 cursor-pointer rounded-full text-content-muted hover:text-content',
                className,
            )}
            {...props}>
            {/* 20px, the same as the sidebar's nav icons, so the whole shell
                speaks one icon size. That makes these glyphs a step larger than
                the 16px magnifier in the search trigger beside them, which is
                the intended reading: the search is a labelled field and these
                are bare controls that have to carry their meaning alone. */}
            <HugeiconsIcon icon={icon} className='size-5' />
            {indicator && (
                // A dot, not a number. The header is a dense row and a count
                // chip beside the icon reads as a separate control; the exact
                // number is in the panel's own header, one click away.
                //
                // Offset to sit ON the glyph's top-right corner rather than in
                // the button's: at 36px with a 20px icon there is 8px of empty
                // padding, and a dot parked out there reads as a separate mark.
                <span
                    aria-hidden
                    className='absolute top-2 right-2 size-2 rounded-full bg-danger-solid ring-2 ring-surface-raised'
                />
            )}
        </Button>
    );
}
