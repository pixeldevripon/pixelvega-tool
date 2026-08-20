'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useUpdateProfile } from '@/hooks/profile/use-profile';
import {
    personalInformationSchema,
    type PersonalInformationValues,
} from '@/lib/validations/profile';
import type { Option, ProfileOptions, UserProfile } from '@/types/profile';

import {
    AccountSection,
    AccountSectionActions,
    AccountTextField,
    FieldLabel,
    FieldRow,
    SaveButton,
} from './account-section';
import { AvatarField } from './avatar-field';

/**
 * Name, contact and identity.
 *
 * ── The selects hold no lists ──
 *
 * Countries, genders and roles all arrive on `options` from
 * `GET /profiles/options` (D4). A country list in a browser is a political
 * question two clients would answer differently, and the frontend this replaced
 * shipped one.
 *
 * ── Role is present, disabled, and explained ──
 *
 * The reference design has a Role select. Nobody may change their own role here:
 * `UsersService.update` refuses it outright. Rather than drop the field or
 * silently offer one that 403s, it renders with the caller's role selected and
 * disabled from `capabilities.canChangeRole`, with the reason underneath.
 */
export function PersonalInformationSection({
    user,
    options,
}: {
    user: UserProfile;
    options: ProfileOptions;
}) {
    const updateProfile = useUpdateProfile();

    const {
        register,
        handleSubmit,
        control,
        reset,
        formState: { errors, isDirty },
    } = useForm<PersonalInformationValues>({
        resolver: zodResolver(personalInformationSchema),
        defaultValues: toFormValues(user),
    });

    const onSave = handleSubmit((values) => {
        updateProfile.mutate(values, {
            onSuccess: (profile) => {
                toast.success('Personal information saved');
                // Reset from the SERVER's copy, not from what was typed. The
                // backend trims, recomposes the full name and may reject a
                // value, so resetting to the submitted values would leave the
                // form clean while showing something not stored.
                reset(toFormValues(profile));
            },
        });
    });

    const canEdit = user.capabilities.canEditProfile;

    return (
        <AccountSection
            title='Personal Information'
            description='Manage your personal information and role.'>
            <form onSubmit={onSave} className='space-y-6'>
                <AvatarField
                    user={user}
                    maxSizeMb={options.avatarMaxSizeMb}
                    disabled={!canEdit}
                />

                <FieldRow>
                    <AccountTextField
                        label='First Name'
                        placeholder='John'
                        autoComplete='given-name'
                        disabled={!canEdit}
                        registration={register('firstName')}
                        error={errors.firstName?.message}
                    />
                    <AccountTextField
                        label='Last Name'
                        placeholder='Doe'
                        autoComplete='family-name'
                        disabled={!canEdit}
                        registration={register('lastName')}
                        error={errors.lastName?.message}
                    />
                </FieldRow>

                <FieldRow>
                    <AccountTextField
                        label='Mobile'
                        type='tel'
                        placeholder='+1 (555) 123-4567'
                        autoComplete='tel'
                        disabled={!canEdit}
                        registration={register('phone')}
                        error={errors.phone?.message}
                    />
                    <Controller
                        control={control}
                        name='country'
                        render={({ field }) => (
                            <SelectField
                                label='Country'
                                placeholder='Select Country'
                                value={field.value ?? ''}
                                onChange={field.onChange}
                                options={options.countries}
                                disabled={!canEdit}
                            />
                        )}
                    />
                </FieldRow>

                <FieldRow>
                    <Controller
                        control={control}
                        name='gender'
                        render={({ field }) => (
                            <SelectField
                                label='Gender'
                                placeholder='Select a gender'
                                value={field.value ?? ''}
                                onChange={field.onChange}
                                options={options.genders}
                                disabled={!canEdit}
                            />
                        )}
                    />
                    <SelectField
                        label='Role'
                        placeholder='Select a role'
                        value={user.role.value}
                        onChange={() => undefined}
                        options={options.roles}
                        disabled={!user.capabilities.canChangeRole}
                        description='Your role is set by an administrator.'
                    />
                </FieldRow>

                <AccountSectionActions>
                    <SaveButton
                        type='submit'
                        disabled={!isDirty || !canEdit}
                        isPending={updateProfile.isPending}
                    />
                </AccountSectionActions>
            </form>
        </AccountSection>
    );
}

/**
 * The API's shape onto the form's.
 *
 * `country` and `gender` arrive as display objects and are edited as their
 * values; every text field is `?? ''` because an uncontrolled input given
 * `undefined` and then a string logs React's controlled-input warning and
 * loses the first keystroke.
 */
function toFormValues(user: UserProfile): PersonalInformationValues {
    return {
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        phone: user.phone ?? '',
        country: user.country?.value ?? '',
        gender: user.gender?.value ?? '',
    };
}

/**
 * A select over options the API sent.
 *
 * Typed on `Option` and satisfied by an `EnumDisplay` too, which structurally
 * has both fields. That is deliberate: the control only ever needs a value and
 * a label, and asking for a tone it will not render would stop countries using
 * it.
 *
 * Radix refuses an empty string as an item value (it reserves it for "nothing
 * selected"), so a cleared select simply has no item selected and the
 * placeholder shows. Clearing back to nothing after choosing is not offered
 * here: the API takes an empty string for that, and a select with a "none"
 * option that is not in the server's list is a value the DTO would reject.
 */
function SelectField({
    label,
    placeholder,
    value,
    onChange,
    options,
    disabled,
    description,
}: {
    label: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    disabled?: boolean;
    description?: string;
}) {
    return (
        <div className='space-y-2'>
            <FieldLabel>{label}</FieldLabel>
            <Select
                value={value || undefined}
                onValueChange={onChange}
                disabled={disabled}>
                <SelectTrigger className='w-full' aria-label={label}>
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {description ? (
                <p className='text-xs text-content-muted'>{description}</p>
            ) : null}
        </div>
    );
}
