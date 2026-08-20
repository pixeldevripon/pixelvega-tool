import { z } from 'zod';

import { MIN_PASSWORD_LENGTH } from '@/lib/constants/auth';
import * as FieldLength from '@/lib/constants/field-lengths';

/**
 * These schemas MIRROR the backend DTOs and are a convenience, never the gate
 * (D5). The API validates every one of these rules again with
 * `class-validator`, plus `whitelist` and `forbidNonWhitelisted`. Where a
 * schema here disagrees with a DTO, the backend is right and this file is the
 * bug.
 *
 * The bounds come from `lib/constants/field-lengths.ts`, which mirrors the
 * backend's `common/constants/field-lengths.ts`, so the two move together
 * instead of drifting apart one literal at a time.
 */

/**
 * The editable identity fields on `PATCH /profiles/me`.
 *
 * `avatarUrl` is deliberately absent: an avatar is a file upload to
 * `POST /profiles/me/avatar`, not a URL a client may set. Letting a client
 * choose the URL would let it point the avatar at any host.
 *
 * The employee-only fields (`designation`, `bio`, `currentStatus`,
 * `availabilityStatus`) and the client-only ones (`companyName`,
 * `billingEmail`) are optional here for one reason: which of them the API
 * accepts depends on whether the caller has an `EmployeeProfile` or a
 * `ClientProfile`, and that is the server's decision to make, not a shape this
 * schema should try to encode.
 */
export const profileSchema = z.object({
    name: z
        .string()
        .min(2, 'Use at least 2 characters')
        .max(FieldLength.PROFILE_NAME,
            `Keep this under ${FieldLength.PROFILE_NAME} characters`),
    designation: z
        .string()
        .max(
            FieldLength.PROFILE_DESIGNATION,
            `Keep this under ${FieldLength.PROFILE_DESIGNATION} characters`,
        )
        .optional(),
    phone: z
        .string()
        .max(
            FieldLength.PROFILE_PHONE,
            `Keep this under ${FieldLength.PROFILE_PHONE} characters`,
        )
        .optional(),
    timezone: z.string().max(FieldLength.PROFILE_TIMEZONE).optional(),
    bio: z
        .string()
        .max(FieldLength.PROFILE_BIO,
            `Keep this under ${FieldLength.PROFILE_BIO} characters`,)
        .optional(),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

/**
 * `POST /api/auth/change-password`.
 *
 * No confirm-password field, on purpose: password managers make it redundant,
 * and the reveal toggle on the input covers the typo case it was guarding
 * against.
 *
 * The minimum is `minPasswordLength: 8` from the backend's auth instance. It
 * was 12 in the copied dashboard, which was that product's rule and would have
 * rejected passwords this API accepts. The maximum is the backend's `PASSWORD_MAX`, which exists
 * because hashing is deliberately expensive: an unbounded password is a way to
 * make the server do unbounded work on an unauthenticated route.
 */
export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z
        .string()
        .min(
            MIN_PASSWORD_LENGTH,
            `Use at least ${MIN_PASSWORD_LENGTH} characters`,
        )
        .max(
            FieldLength.PASSWORD_MAX,
            `Keep this under ${FieldLength.PASSWORD_MAX} characters`,
        ),
});

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
