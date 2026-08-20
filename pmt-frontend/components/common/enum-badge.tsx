import type { EnumDisplay } from '@/contexts/role-context';
import {
    StatusBadge,
    type StatusVariant,
} from '@/components/common/status-badge';

/**
 * Renders an enum the API sent, at the severity the API decided.
 *
 * **This is the only place a tone becomes a class.** No component may declare
 * its own label map or its own tone map. The reason is not tidiness: deciding
 * that "waiting for feedback" is a warning while "on hold" is equally bad is a
 * judgment about the business, and two screens are not free to disagree about
 * it. The server holds that judgment (ADR 0001) and this file spends it.
 *
 * The frontend this replaced carried a 614 line map doing exactly that, per
 * enum, in the browser. It is gone, and the ESLint presentation-only rule group
 * exists to keep it gone.
 */

/**
 * The API's five tones onto the badge's five variants.
 *
 * `Record<...>`, not a lookup with a fallback, so adding a tone to
 * `DISPLAY_TONES` on the server fails the build here until someone decides how
 * it reads. A silent `?? 'neutral'` would render the new tone as grey forever
 * and nobody would find out.
 *
 * `default` maps to neutral and `primary` to info: the badge has no "brand"
 * surface, and giving a merely-current status the brand colour would make every
 * in-progress row compete with the page's own primary action.
 */
const TONE_TO_VARIANT: Record<EnumDisplay['tone'], StatusVariant> = {
    default: 'neutral',
    primary: 'info',
    success: 'success',
    warning: 'warning',
    danger: 'danger',
};

export function toneToVariant(tone: string): StatusVariant {
    // A tone the server grew before this file caught up renders as neutral
    // rather than throwing. Same asymmetry as the permission set: the client
    // must never break on an API that moved forward.
    return TONE_TO_VARIANT[tone as EnumDisplay['tone']] ?? 'neutral';
}

export function EnumBadge({
    display,
    /** One line of plain English, shown on hover. The API sends it for statuses. */
    hint,
    className,
}: {
    display: EnumDisplay & { description?: string };
    hint?: string;
    className?: string;
}) {
    return (
        <StatusBadge
            variant={toneToVariant(display.tone)}
            hint={hint ?? display.description}
            className={className}>
            {display.label}
        </StatusBadge>
    );
}
