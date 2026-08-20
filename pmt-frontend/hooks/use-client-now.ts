'use client';

import { useEffect, useState } from 'react';

/**
 * The browser's clock, read once after mount. Null on the first render.
 *
 * ── Why not just call `Date.now()` ──
 *
 * Calling it during render is impure: two renders of the same component return
 * different values, so anything derived from it can change without any state
 * changing. `react-hooks/purity` rejects it, and correctly. A `useMemo` does not
 * fix that, it only hides how often it happens.
 *
 * ── Why the null first render is not a defect ──
 *
 * There is no honest value to return before mount. The server renders this page
 * too, and its clock is not the visitor's, so a value picked during SSR would be
 * wrong for anyone in another timezone and would then be replaced on hydration,
 * which is the mismatch React warns about.
 *
 * Callers render their skeleton for that one frame.
 *
 * ── What this may and may not be used for ──
 *
 * Presentation anchored to "now": which column of an axis is today, whether to
 * show a marker at all. NEVER for a business figure. A countdown, an overdue
 * flag or an age in minutes is measured on the server against the one clock the
 * whole team shares, and arrives as a response field (D4). A browser three hours
 * out would otherwise disagree with the number printed beside it.
 */
export function useClientNow(): number | null {
    const [nowMs, setNowMs] = useState<number | null>(null);

    useEffect(() => {
        setNowMs(Date.now());
    }, []);

    return nowMs;
}
