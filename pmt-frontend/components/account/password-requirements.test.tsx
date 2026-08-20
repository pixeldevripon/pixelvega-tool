import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { metPasswordRules } from '@/lib/validations/profile';
import type { PasswordPolicy } from '@/types/profile';

import { PasswordRequirements } from './password-requirements';

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

const renderFor = (value: string, custom: PasswordPolicy = policy) =>
    render(
        <PasswordRequirements
            policy={custom}
            met={metPasswordRules(custom, value)}
            value={value}
        />,
    );

describe('the checklist', () => {
    it('renders the API\'s wording, not its own', () => {
        // The whole reason the policy is served. A label written here would
        // drift from the rule the server enforces, which is how a checklist
        // starts promising something untrue.
        const custom: PasswordPolicy = {
            ...policy,
            rules: [
                { key: 'MIN_LENGTH', label: 'Mindestens 12 Zeichen', pattern: '.{12,}' },
            ],
        };
        renderFor('', custom);
        expect(screen.getByText('Mindestens 12 Zeichen')).toBeInTheDocument();
    });

    it('renders one row per served rule, however many there are', () => {
        renderFor('');
        expect(screen.getAllByRole('listitem')).toHaveLength(5);
    });

    it('announces which requirements are met, not only by colour', () => {
        // Colour must never be the sole carrier of meaning (WCAG 1.4.1 A).
        renderFor('abc');
        const lowercase = screen
            .getByText('At least 1 lowercase letter')
            .closest('li')!;
        expect(lowercase).toHaveTextContent('met');

        const uppercase = screen
            .getByText('At least 1 uppercase letter')
            .closest('li')!;
        expect(uppercase).toHaveTextContent('not met');
    });
});

describe('the strength meter', () => {
    it('starts at nothing met', () => {
        renderFor('');
        const meter = screen.getByRole('progressbar', {
            name: 'Password strength',
        });
        expect(meter).toHaveAttribute('aria-valuenow', '0');
        expect(meter).toHaveAttribute(
            'aria-valuetext',
            '0 of 5 requirements met',
        );
    });

    it('counts the rules a partial password satisfies', () => {
        renderFor('abcABC');
        expect(
            screen.getByRole('progressbar', { name: 'Password strength' }),
        ).toHaveAttribute('aria-valuenow', '2');
    });

    it('is full exactly when the server would accept the password', () => {
        renderFor('Correct-Horse9!');
        const meter = screen.getByRole('progressbar', {
            name: 'Password strength',
        });
        expect(meter).toHaveAttribute('aria-valuenow', '5');
        expect(meter).toHaveAttribute('aria-valuemax', '5');
    });
});

describe('the maximum length', () => {
    it('says nothing while the value is within bounds', () => {
        renderFor('Correct-Horse9!');
        expect(screen.queryByText(/Keep this under/)).not.toBeInTheDocument();
    });

    it('warns using the served maximum rather than a number of its own', () => {
        renderFor('A1!'.padEnd(200, 'a'));
        expect(
            screen.getByText('Keep this under 128 characters.'),
        ).toBeInTheDocument();
    });
});
