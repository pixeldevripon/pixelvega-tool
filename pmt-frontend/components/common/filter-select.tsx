'use client';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/**
 * A dropdown filter that can be cleared.
 *
 * ── Why this is shared rather than written per screen ──
 *
 * A `Select` cannot hold an empty string as a value, so "no filter" needs a
 * sentinel, and the sentinel has to be translated back to `undefined` before it
 * reaches the query. Every copy of that translation is a chance to forget it,
 * and forgetting it sends the literal `"__any__"` to the API as a status. Since
 * `forbidNonWhitelisted` is on, that is a 400 rather than a quiet miss, which is
 * better but still a broken screen.
 *
 * Six list screens need this. One implementation.
 */

/** Sentinel for "no filter". Never leaves this file. */
const ANY = '__any__';

export type FilterOption = { value: string; label: string };

export function FilterSelect({
    label,
    placeholder,
    value,
    options,
    onChange,
    className,
}: {
    /** The accessible name. Icon-free triggers still need one. */
    label: string;
    /** Shown when nothing is selected, and as the clear-it option. */
    placeholder: string;
    value: string | undefined;
    options: FilterOption[];
    onChange: (value: string | undefined) => void;
    className?: string;
}) {
    return (
        <Select
            value={value ?? ANY}
            onValueChange={(next) => onChange(next === ANY ? undefined : next)}>
            <SelectTrigger
                className={cn('h-9 w-40', className)}
                aria-label={label}>
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={ANY}>{placeholder}</SelectItem>
                {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
