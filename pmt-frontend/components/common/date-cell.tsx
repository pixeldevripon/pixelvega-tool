'use client';

/**
 * A date in a table cell.
 *
 * `Intl` formatting only, which is a locale preference rather than a business
 * rule and is therefore the client's job. Anything derived FROM the date (how
 * old it is, whether it is late) arrives already decided as a response field:
 * a browser three hours off must not disagree with the figure beside it (D4).
 */
export function DateCell({
    value,
    withTime = false,
}: {
    value: string | null | undefined;
    withTime?: boolean;
}) {
    if (!value) return <span className='text-content-subtle'>—</span>;

    const date = new Date(value);

    return (
        <span className='whitespace-nowrap text-sm tabular-nums text-content'>
            {date.toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
            })}
            {withTime && (
                <span className='ml-1.5 text-2xs text-content-muted'>
                    {date.toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                </span>
            )}
        </span>
    );
}
