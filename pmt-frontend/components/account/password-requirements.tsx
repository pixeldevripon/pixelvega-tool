'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, Tick02Icon } from '@hugeicons/core-free-icons';

import { cn } from '@/lib/utils';
import type { PasswordPolicy } from '@/types/profile';

/**
 * The strength meter and the requirement checklist from the reference design.
 *
 * ── Every word and every rule here comes from the API ──
 *
 * `policy` is `GET /profiles/options`, which serves the SAME table the server
 * enforces with: one `{ key, label, pattern }` per rule. This component
 * compiles the patterns and renders the labels. It states no rule of its own,
 * which is the only way the checklist can be honest about the gate: the version
 * this replaced promised "at least 12 characters" against a server that
 * accepted eight.
 *
 * ── The meter is the count of rules met ──
 *
 * Not an entropy estimate. Five segments for five requirements, so the bar and
 * the list are the same fact shown twice, and a full bar means exactly "the
 * server will accept this".
 */
export function PasswordRequirements({
    policy,
    met,
    value,
}: {
    policy: PasswordPolicy;
    /** The keys of the rules the current value satisfies. */
    met: Set<string>;
    value: string;
}) {
    const total = policy.rules.length;
    const passed = met.size;

    return (
        <div className='space-y-4'>
            <div
                className='flex gap-1.5'
                role='progressbar'
                aria-label='Password strength'
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={passed}
                aria-valuetext={`${passed} of ${total} requirements met`}>
                {policy.rules.map((rule, index) => (
                    <span
                        key={rule.key}
                        className={cn(
                            'h-1 flex-1 rounded-full transition-colors',
                            // Filled left to right by COUNT rather than by which
                            // rule passed, so the bar grows steadily instead of
                            // lighting up a gap in the middle.
                            index < passed
                                ? strengthClass(passed, total)
                                : 'bg-surface-inset',
                        )}
                    />
                ))}
            </div>

            <div>
                <p className='text-sm font-medium'>
                    Enter a password. Must contain :
                </p>
                <ul className='mt-2 space-y-1.5'>
                    {policy.rules.map((rule) => {
                        const ok = met.has(rule.key);
                        return (
                            <li
                                key={rule.key}
                                className={cn(
                                    'flex items-center gap-2 text-sm',
                                    ok ? 'text-success-fg' : 'text-content-muted',
                                )}>
                                <HugeiconsIcon
                                    icon={ok ? Tick02Icon : Cancel01Icon}
                                    className='size-4 shrink-0'
                                    // The tick and the cross are decorative: the
                                    // state is announced by the text below, so a
                                    // screen reader would otherwise hear it twice.
                                    aria-hidden='true'
                                />
                                <span>{rule.label}</span>
                                <span className='sr-only'>
                                    {ok ? 'met' : 'not met'}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </div>

            {value.length > policy.maxLength ? (
                <p className='text-xs font-medium text-danger-fg'>
                    Keep this under {policy.maxLength} characters.
                </p>
            ) : null}
        </div>
    );
}

/**
 * Three bands, not five colours.
 *
 * Anything short of every rule is a password the server will refuse, so the
 * distinction that matters is "refused" against "accepted". Warning in between
 * exists only so the bar reads as progress rather than as failure while
 * somebody is still typing.
 */
function strengthClass(passed: number, total: number): string {
    if (passed >= total) return 'bg-success-solid';
    if (passed >= Math.ceil(total / 2)) return 'bg-warning-solid';
    return 'bg-danger-solid';
}
