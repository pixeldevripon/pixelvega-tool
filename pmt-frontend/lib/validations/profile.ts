import { z } from 'zod';

import * as FieldLength from '@/lib/constants/field-lengths';
import type { PasswordPolicy } from '@/types/profile';

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

const optionalText = (max: number, label: string) =>
    z
        .string()
        .max(max, `Keep ${label} under ${max} characters`)
        .optional();

/**
 * The Personal Information block on `PATCH /profiles/me`.
 *
 * `name` is deliberately absent: the server composes it from the two halves, so
 * a form that also sent a full name could store one contradicting its own
 * parts. `country` and `gender` are plain strings because their allowed values
 * come from `GET /profiles/options` at runtime, and a Zod enum built from a
 * fetched list would only ever restate what the select already offers.
 */
export const personalInformationSchema = z.object({
    firstName: optionalText(FieldLength.NAME_PART, 'a first name'),
    lastName: optionalText(FieldLength.NAME_PART, 'a last name'),
    phone: optionalText(FieldLength.PROFILE_PHONE, 'a mobile number'),
    country: z.string().optional(),
    gender: z.string().optional(),
});

export type PersonalInformationValues = z.infer<
    typeof personalInformationSchema
>;

/**
 * The Social URLs block.
 *
 * An array of objects rather than of strings, because `useFieldArray` keys its
 * rows off a generated `id` on each item and cannot do that for a primitive.
 * Empty rows are allowed here and stripped before the request: someone who adds
 * a row and changes their mind should be able to save, not be blocked by a
 * field they never filled in.
 */
export const socialUrlsSchema = z.object({
    urls: z.array(
        z.object({
            value: z
                .string()
                .max(
                    FieldLength.SOCIAL_URL,
                    `Keep a link under ${FieldLength.SOCIAL_URL} characters`,
                )
                .refine(
                    (value) =>
                        value.trim() === '' || /^https?:\/\/\S+\.\S+/.test(value),
                    'Start with http:// or https://',
                ),
        }),
    ),
});

export type SocialUrlsValues = z.infer<typeof socialUrlsSchema>;

/**
 * `POST /api/auth/change-password`, built from the policy the API serves.
 *
 * A FACTORY, not a constant, and that is the whole point: the rules, their
 * wording and their patterns all come from `GET /profiles/options`, which is
 * the same table the server enforces with. The version this replaced hardcoded
 * a minimum here, and that number disagreed with the backend's in both
 * directions at different times.
 *
 * No confirm-password field, on purpose: password managers make it redundant,
 * and the reveal toggle on the input covers the typo case it was guarding
 * against.
 */
export function buildChangePasswordSchema(policy: PasswordPolicy) {
    return z.object({
        currentPassword: z.string().min(1, 'Enter your current password'),
        newPassword: z
            .string()
            .max(
                policy.maxLength,
                `Keep this under ${policy.maxLength} characters`,
            )
            // `superRefine` rather than a chain of `.refine`, for two reasons.
            // It reports EVERY failing rule in one pass, matching what the API
            // does, so one mistake is not five submissions. And a chain of
            // refinements over a runtime list widens the inferred type to
            // `unknown`, which then breaks the resolver's contract with the form.
            .superRefine((value, ctx) => {
                for (const rule of policy.rules) {
                    if (!new RegExp(rule.pattern).test(value)) {
                        ctx.addIssue({ code: 'custom', message: rule.label });
                    }
                }
            }),
    });
}

export type ChangePasswordValues = z.infer<
    ReturnType<typeof buildChangePasswordSchema>
>;

/**
 * Which requirements a candidate password currently meets.
 *
 * Used for the live checklist and the strength meter, so it runs on every
 * keystroke and returns the RULES rather than booleans: the checklist renders
 * the server's wording next to each tick, and inventing labels here is exactly
 * what serving the policy was meant to stop.
 */
export function metPasswordRules(
    policy: PasswordPolicy,
    value: string,
): Set<string> {
    return new Set(
        policy.rules
            .filter((rule) => new RegExp(rule.pattern).test(value))
            .map((rule) => rule.key),
    );
}
