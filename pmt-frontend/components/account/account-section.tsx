'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Loading03Icon } from '@hugeicons/core-free-icons';
import { useId, type ReactNode } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * The primitives every block on the account screen is built from.
 *
 * The layout is the reference design's: a description column on the left and
 * the controls on the right, sections separated by hairlines, no cards and no
 * shadows. It collapses to one column below `lg`, where a 1/3 column of prose
 * beside a form field is unreadable.
 *
 * Local to `components/account/` rather than shared: the settings form kit in
 * `components/common/` is card-shaped (`SettingsCard` renders a `Card` with a
 * footer Save) and this page is deliberately not, and eslint D3 forbids one
 * module's components importing another's.
 */

export function AccountSection({
    title,
    description,
    children,
    className,
}: {
    title: string;
    description?: ReactNode;
    children?: ReactNode;
    className?: string;
}) {
    return (
        <section
            className={cn(
                'grid gap-6 border-b border-line py-8 first:pt-0 last:border-b-0 lg:grid-cols-3 lg:gap-12',
                className,
            )}>
            <div className='lg:col-span-1'>
                <h2 className='text-base font-semibold'>{title}</h2>
                {description ? (
                    <p className='mt-1 text-sm text-content-muted'>
                        {description}
                    </p>
                ) : null}
            </div>
            <div className='min-w-0 lg:col-span-2'>{children}</div>
        </section>
    );
}

/**
 * The row a Save button sits on, aligned right as in the reference.
 *
 * Its own component so every block spaces its action the same way. Three blocks
 * doing this inline drifted by 2px each in the design this replaces.
 */
export function AccountSectionActions({ children }: { children: ReactNode }) {
    return <div className='mt-6 flex justify-end gap-2'>{children}</div>;
}

/**
 * Save, spinning while its mutation is in flight.
 *
 * `type` is a prop because this button is used two ways: fired from a handler,
 * and as the submit button of a real `<form>`. A form needs `type='submit'` so
 * that Enter in a field submits, which is how people actually complete a
 * two-field password form.
 */
export function SaveButton({
    onClick,
    disabled,
    isPending,
    label = 'Save Changes',
    type = 'button',
}: {
    onClick?: () => void;
    disabled?: boolean;
    isPending?: boolean;
    label?: string;
    type?: 'button' | 'submit';
}) {
    return (
        <Button type={type} onClick={onClick} disabled={disabled || isPending}>
            {isPending ? (
                <HugeiconsIcon
                    icon={Loading03Icon}
                    className='size-4 animate-spin'
                />
            ) : null}
            {label}
        </Button>
    );
}

/** Label + input + optional hint, with the page's inline error treatment. */
export function AccountTextField({
    label,
    registration,
    error,
    description,
    placeholder,
    type = 'text',
    disabled,
    required,
    autoComplete,
}: {
    label: string;
    registration: UseFormRegisterReturn;
    error?: string;
    description?: string;
    placeholder?: string;
    type?: string;
    disabled?: boolean;
    required?: boolean;
    autoComplete?: string;
}) {
    const id = useId();
    return (
        <div className='space-y-2'>
            <FieldLabel htmlFor={id} required={required}>
                {label}
            </FieldLabel>
            <Input
                id={id}
                type={type}
                placeholder={placeholder}
                disabled={disabled}
                autoComplete={autoComplete}
                aria-invalid={!!error}
                {...registration}
            />
            {description ? (
                <p className='text-xs text-content-muted'>{description}</p>
            ) : null}
            {error ? (
                <p className='text-xs font-medium text-danger-fg'>{error}</p>
            ) : null}
        </div>
    );
}

/**
 * A label with the reference's red asterisk for a required field.
 *
 * `aria-hidden` on the asterisk: it is a visual convention, and a screen reader
 * announcing "star" adds nothing. The control itself carries `required`, which
 * is what assistive technology actually reads.
 */
export function FieldLabel({
    htmlFor,
    required,
    children,
}: {
    htmlFor?: string;
    required?: boolean;
    children: ReactNode;
}) {
    return (
        <Label htmlFor={htmlFor}>
            {children}
            {required ? (
                <span aria-hidden='true' className='text-danger-fg'>
                    *
                </span>
            ) : null}
        </Label>
    );
}

/**
 * A value the API says cannot be edited here, rendered as a field-shaped row
 * rather than as a disabled `<input>`.
 *
 * A disabled input invites a click that does nothing. This reads as
 * information, which is what it is, and the hint says who CAN change it: a
 * control with no explanation is the thing people file bugs about.
 */
export function ReadOnlyField({
    label,
    value,
    hint,
    trailing,
}: {
    label: string;
    value: ReactNode;
    hint?: string;
    trailing?: ReactNode;
}) {
    const id = useId();
    return (
        <div className='space-y-2'>
            <Label id={id}>{label}</Label>
            <div
                role='group'
                aria-labelledby={id}
                className='flex min-h-9 items-center justify-between gap-3 rounded-md border border-input bg-surface-sunken px-3 py-2'>
                <span className='truncate text-sm'>{value}</span>
                {trailing}
            </div>
            {hint ? (
                <p className='text-xs text-content-muted'>{hint}</p>
            ) : null}
        </div>
    );
}

/** The two-column grid the reference uses for paired fields. */
export function FieldRow({ children }: { children: ReactNode }) {
    return <div className='grid gap-6 sm:grid-cols-2'>{children}</div>;
}
