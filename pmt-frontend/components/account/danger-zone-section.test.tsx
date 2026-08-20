import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserProfile } from '@/types/profile';

import { DangerZoneSection } from './danger-zone-section';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
}));

const deleteAccount = vi.fn();
vi.mock('@/lib/api/profile', () => ({
    profileApi: { deleteAccount: (email: string) => deleteAccount(email) },
}));

const profile = (
    overrides: Partial<UserProfile['capabilities']> = {},
): UserProfile =>
    ({
        id: 'u1',
        email: 'developer@pixelvega.com',
        name: 'Rezina Akter',
        firstName: 'Rezina',
        lastName: 'Akter',
        phone: null,
        country: null,
        gender: null,
        socialUrls: [],
        avatarUrl: null,
        role: { value: 'DEVELOPER', label: 'Developer', tone: 'default' },
        status: { value: 'ACTIVE', label: 'Active', tone: 'success' },
        createdAt: '2026-08-01T09:00:00.000Z',
        capabilities: {
            canEditProfile: true,
            canChangeEmail: false,
            canChangeRole: false,
            canDeleteAccount: true,
            ...overrides,
        },
        connectedAccounts: [],
    }) as UserProfile;

function renderSection(user: UserProfile) {
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={new QueryClient()}>
            {children}
        </QueryClientProvider>
    );
    return render(<DangerZoneSection user={user} />, { wrapper });
}

beforeEach(() => {
    vi.clearAllMocks();
    deleteAccount.mockResolvedValue({ message: 'Account deleted.' });
});

describe('the capability gate', () => {
    it('offers Delete when the API says the account may be deleted', () => {
        renderSection(profile());
        expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
    });

    it('disables Delete when the API refuses, rather than hiding the block', () => {
        // A Danger Zone that silently vanishes for one account looks like a
        // rendering bug to the person it vanished for.
        renderSection(profile({ canDeleteAccount: false }));
        expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    });

    it('says WHY it is refused', () => {
        renderSection(profile({ canDeleteAccount: false }));
        expect(
            screen.getByText(/system admin account cannot be deleted/i),
        ).toBeInTheDocument();
    });

    it('reads the flag, never the role', () => {
        // A SYSTEM_ADMIN whose flag says true must still get the button: the
        // server decides, and a client re-deriving the rule is how a screen and
        // its API come to disagree.
        const rootWithFlag = profile();
        rootWithFlag.role = {
            value: 'SYSTEM_ADMIN',
            label: 'System admin',
            tone: 'danger',
        };
        renderSection(rootWithFlag);
        expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
    });
});

describe('the confirmation', () => {
    it('keeps the confirm button disabled until the email matches', async () => {
        renderSection(profile());
        await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

        const confirm = screen.getByRole('button', { name: /delete account/i });
        expect(confirm).toBeDisabled();

        await userEvent.type(
            screen.getByLabelText(/to confirm/i),
            'wrong@example.com',
        );
        expect(confirm).toBeDisabled();
    });

    it('accepts a differently cased email, because an address is case insensitive', async () => {
        renderSection(profile());
        await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
        await userEvent.type(
            screen.getByLabelText(/to confirm/i),
            'Developer@PixelVega.com',
        );
        expect(
            screen.getByRole('button', { name: /delete account/i }),
        ).toBeEnabled();
    });

    it('sends what was typed and then leaves for the sign-in screen', async () => {
        renderSection(profile());
        await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
        await userEvent.type(
            screen.getByLabelText(/to confirm/i),
            'developer@pixelvega.com',
        );
        await userEvent.click(
            screen.getByRole('button', { name: /delete account/i }),
        );

        expect(deleteAccount).toHaveBeenCalledWith('developer@pixelvega.com');
        // `replace`, not `push`: Back must not return to a dashboard rendered
        // for an account that no longer exists.
        expect(replace).toHaveBeenCalledWith('/login');
    });
});
