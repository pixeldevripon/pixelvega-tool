'use client';

import { GibbousMoonIcon, Sun03Icon } from '@hugeicons/core-free-icons';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { HeaderIconButton } from '@/components/shell/header-icon-button';

/**
 * Light and dark, in the header.
 *
 * It moved out of the profile menu, where it was a two-pill segmented control:
 * the theme is a per-visit preference people flip when the room changes, and
 * burying it two clicks deep behind an avatar made it feel like a setting.
 *
 * `resolvedTheme`, NOT `theme`. `theme` is the STORED preference, which is still
 * `'system'` for everyone on a first visit (the provider's default) and for
 * anyone who chose that before the option went away. Toggling off it would need
 * two clicks to leave `'system'`, and the icon would be wrong until it did.
 *
 * ── Why the mounted gate ──
 *
 * The server cannot know the resolved theme, so rendering the sun or the moon
 * before hydration is a guaranteed mismatch. Until mounted this renders the sun
 * with no theme claim attached and no handler, which keeps the header's layout
 * from shifting by 36px the moment React takes over.
 */
export function ThemeToggleButton() {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    const dark = mounted && resolvedTheme === 'dark';

    return (
        // The gibbous moon rather than a bare crescent: it is a full circle with
        // the crescent cut into it, so it holds the same round footprint as the
        // bell beside it instead of hanging in the corner of its own button.
        <HeaderIconButton
            icon={dark ? Sun03Icon : GibbousMoonIcon}
            label={dark ? 'Switch to the light theme' : 'Switch to the dark theme'}
            disabled={!mounted}
            onClick={() => setTheme(dark ? 'light' : 'dark')}
            // The disabled state before mount must not look broken: this is a
            // control that becomes live a frame later, not one the caller may
            // not use.
            className='disabled:opacity-100'
        />
    );
}
