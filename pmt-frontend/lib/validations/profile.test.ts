import { describe, expect, it } from 'vitest';

import type { PasswordPolicy } from '@/types/profile';

import {
    buildChangePasswordSchema,
    metPasswordRules,
    personalInformationSchema,
    socialUrlsSchema,
} from './profile';

/** Exactly what `GET /profiles/options` serves, so these are the real rules. */
const policy: PasswordPolicy = {
    minLength: 12,
    maxLength: 128,
    rules: [
        { key: 'MIN_LENGTH', label: 'At least 12 characters', pattern: '.{12,}' },
        { key: 'LOWERCASE', label: 'At least 1 lowercase letter', pattern: '[a-z]' },
        { key: 'UPPERCASE', label: 'At least 1 uppercase letter', pattern: '[A-Z]' },
        { key: 'NUMBER', label: 'At least 1 number', pattern: '[0-9]' },
        { key: 'SPECIAL', label: 'At least 1 special character', pattern: '[^A-Za-z0-9]' },
    ],
};

describe('buildChangePasswordSchema', () => {
    it('accepts a password meeting every served rule', () => {
        const result = buildChangePasswordSchema(policy).safeParse({
            currentPassword: 'whatever',
            newPassword: 'Correct-Horse9!',
        });
        expect(result.success).toBe(true);
    });

    it('reports EVERY failing rule at once, matching the API', () => {
        // One mistake must not become five submissions. The server answers the
        // same way, so the two agree about how many attempts this takes.
        const result = buildChangePasswordSchema(policy).safeParse({
            currentPassword: 'whatever',
            newPassword: 'aaaaaaaaaaaaaa',
        });
        expect(result.success).toBe(false);
        const messages = result.error!.issues.map((issue) => issue.message);
        expect(messages).toContain('At least 1 uppercase letter');
        expect(messages).toContain('At least 1 number');
        expect(messages).toContain('At least 1 special character');
    });

    it('uses the SERVER\'s wording for a failure, never its own', () => {
        const withOwnWording: PasswordPolicy = {
            ...policy,
            rules: [
                { key: 'MIN_LENGTH', label: 'Use at least 20 characters', pattern: '.{20,}' },
            ],
        };
        const result = buildChangePasswordSchema(withOwnWording).safeParse({
            currentPassword: 'x',
            newPassword: 'short',
        });
        expect(result.error!.issues[0].message).toBe(
            'Use at least 20 characters',
        );
    });

    it('follows the served policy rather than a hardcoded minimum', () => {
        // The whole reason the policy is fetched. A twelve character password
        // must fail against a policy that asks for twenty, and the version this
        // replaced could not express that because the number lived here.
        const strict: PasswordPolicy = {
            ...policy,
            minLength: 20,
            rules: [{ key: 'MIN_LENGTH', label: 'At least 20 characters', pattern: '.{20,}' }],
        };
        expect(
            buildChangePasswordSchema(strict).safeParse({
                currentPassword: 'x',
                newPassword: 'Correct-Horse9!',
            }).success,
        ).toBe(false);
    });

    it('requires a current password', () => {
        const result = buildChangePasswordSchema(policy).safeParse({
            currentPassword: '',
            newPassword: 'Correct-Horse9!',
        });
        expect(result.success).toBe(false);
    });

    it('refuses a password over the served maximum', () => {
        const result = buildChangePasswordSchema(policy).safeParse({
            currentPassword: 'x',
            newPassword: `A1!${'a'.repeat(policy.maxLength)}`,
        });
        expect(result.success).toBe(false);
    });
});

describe('metPasswordRules', () => {
    it('returns nothing for an empty value', () => {
        expect(metPasswordRules(policy, '').size).toBe(0);
    });

    it('reports each rule the value satisfies, by key', () => {
        expect([...metPasswordRules(policy, 'abc')]).toEqual(['LOWERCASE']);
    });

    it('reports every rule for an acceptable password', () => {
        expect(metPasswordRules(policy, 'Correct-Horse9!').size).toBe(
            policy.rules.length,
        );
    });

    it('counts a space as a special character, so a passphrase passes', () => {
        expect(metPasswordRules(policy, 'Correct horse9').has('SPECIAL')).toBe(
            true,
        );
    });
});

describe('socialUrlsSchema', () => {
    it('accepts an empty row, so adding one and changing your mind still saves', () => {
        const result = socialUrlsSchema.safeParse({
            urls: [{ value: '' }, { value: 'https://github.com/rezina' }],
        });
        expect(result.success).toBe(true);
    });

    it('refuses a link with no scheme', () => {
        // Stored without one, it would render as a relative link and navigate
        // inside the dashboard.
        const result = socialUrlsSchema.safeParse({
            urls: [{ value: 'github.com/rezina' }],
        });
        expect(result.success).toBe(false);
    });

    it('accepts http as well as https', () => {
        expect(
            socialUrlsSchema.safeParse({ urls: [{ value: 'http://example.com' }] })
                .success,
        ).toBe(true);
    });

    it('refuses a link over the length bound', () => {
        const result = socialUrlsSchema.safeParse({
            urls: [{ value: `https://example.com/${'a'.repeat(400)}` }],
        });
        expect(result.success).toBe(false);
    });
});

describe('personalInformationSchema', () => {
    it('accepts every field empty, because none of them are required', () => {
        const result = personalInformationSchema.safeParse({
            firstName: '',
            lastName: '',
            phone: '',
            country: '',
            gender: '',
        });
        expect(result.success).toBe(true);
    });

    it('refuses a first name over the bound the DTO enforces', () => {
        const result = personalInformationSchema.safeParse({
            firstName: 'a'.repeat(61),
        });
        expect(result.success).toBe(false);
    });
});
