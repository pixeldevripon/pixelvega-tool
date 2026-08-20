'use client';

import { cn } from '@/lib/utils';

export interface AccountTab {
    key: string;
    label: string;
}

/**
 * The underlined tab row from the reference design.
 *
 * Hand rolled rather than `components/ui/tabs.tsx`, which renders the shadcn
 * pill treatment on a filled track. This is a different control: a hairline
 * runs the full width and the active tab sits on a 2px underline over it.
 *
 * ── It is a real tablist ──
 *
 * `role='tablist'` with arrow-key navigation, because a row of buttons that
 * looks like tabs and is not one is worse for a keyboard user than a row of
 * buttons that looks like buttons. The panel it controls carries `role='tabpanel'`
 * and the matching `aria-labelledby`.
 *
 * ── Which tabs exist is decided by the caller ──
 *
 * The reference has seven. This product has content for two, and the rest are
 * absent rather than present-and-dead: a tab that opens an empty screen is a
 * worse answer than a tab that is not there.
 */
export function AccountTabs({
    tabs,
    active,
    onChange,
}: {
    tabs: AccountTab[];
    active: string;
    onChange: (key: string) => void;
}) {
    const move = (offset: number) => {
        const index = tabs.findIndex((tab) => tab.key === active);
        // Wraps, which is what the WAI-ARIA tabs pattern specifies: pressing
        // right on the last tab goes to the first rather than doing nothing.
        const next = (index + offset + tabs.length) % tabs.length;
        onChange(tabs[next].key);
    };

    return (
        <div
            role='tablist'
            aria-label='Account sections'
            className='flex gap-6 border-b border-line'
            onKeyDown={(event) => {
                if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    move(1);
                }
                if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    move(-1);
                }
            }}>
            {tabs.map((tab) => {
                const isActive = tab.key === active;
                return (
                    <button
                        key={tab.key}
                        id={`account-tab-${tab.key}`}
                        role='tab'
                        type='button'
                        aria-selected={isActive}
                        aria-controls={`account-panel-${tab.key}`}
                        // Only the active tab is in the tab order. Tab moves to
                        // the panel, arrows move between tabs: the pattern a
                        // keyboard user expects from a tablist.
                        tabIndex={isActive ? 0 : -1}
                        onClick={() => onChange(tab.key)}
                        className={cn(
                            'relative -mb-px cursor-pointer whitespace-nowrap border-b-2 px-1 pb-3 text-sm transition-colors',
                            isActive
                                ? 'border-content font-medium text-content'
                                : 'border-transparent text-content-muted hover:text-content',
                        )}>
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}
