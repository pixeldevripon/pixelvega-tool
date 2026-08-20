/**
 * Which modifier key a keyboard shortcut should be advertised with.
 *
 * A pure function of the user agent string rather than a hook, for two reasons.
 * It is testable without a DOM, and it makes the caller's `useEffect` the only
 * place that touches `navigator`: the platform is not knowable during a server
 * render, so a component that reads it while rendering ships HTML the client
 * then disagrees with.
 *
 * `navigator.userAgent`, not `navigator.platform`, which is deprecated and
 * already lies on iPadOS (it reports "MacIntel").
 */

/** True for macOS, iOS and iPadOS. */
export function isApplePlatform(userAgent: string): boolean {
    return /mac|iphone|ipad|ipod/i.test(userAgent);
}

/**
 * The label for the "command palette" modifier: `⌘` where that is what people
 * press, `Ctrl` everywhere else.
 *
 * The palette itself accepts BOTH (`e.metaKey || e.ctrlKey`), so this only
 * decides which one to show. Showing both would be accurate and unreadable.
 */
export function modifierKeyLabel(userAgent: string): string {
    return isApplePlatform(userAgent) ? '⌘' : 'Ctrl';
}
