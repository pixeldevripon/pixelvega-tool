import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConnectedAccount, UserProfile } from '@/types/profile';

import { ConnectedAccountsSection } from './connected-accounts-section';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const disconnect = vi.fn();
vi.mock('@/lib/api/profile', () => ({
    profileApi: { disconnect: (provider: string) => disconnect(provider) },
}));

const CREDENTIAL: ConnectedAccount = {
    provider: {
        value: 'CREDENTIAL',
        label: 'Email and password',
        tone: 'primary',
    },
    detail: null,
    connectedAt: '2026-08-01T09:00:00.000Z',
    canDisconnect: false,
};

const SLACK: ConnectedAccount = {
    provider: { value: 'SLACK', label: 'Slack', tone: 'default' },
    detail: 'U08ABCDEF',
    connectedAt: '2026-08-01T09:00:00.000Z',
    canDisconnect: true,
};

const profile = (connectedAccounts: ConnectedAccount[]): UserProfile =>
    ({ connectedAccounts }) as UserProfile;

function renderSection(connections: ConnectedAccount[]) {
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={new QueryClient()}>
            {children}
        </QueryClientProvider>
    );
    return render(<ConnectedAccountsSection user={profile(connections)} />, {
        wrapper,
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    disconnect.mockResolvedValue(profile([CREDENTIAL]));
});

describe('the chip row', () => {
    it('renders the API\'s label for each connection', () => {
        renderSection([CREDENTIAL, SLACK]);
        expect(screen.getByText('Email and password')).toBeInTheDocument();
        expect(screen.getByText('Slack')).toBeInTheDocument();
    });

    it('shows the detail when there is something safe to show', () => {
        renderSection([SLACK]);
        expect(screen.getByText('U08ABCDEF')).toBeInTheDocument();
    });

    it('says so when nothing is connected', () => {
        renderSection([]);
        expect(
            screen.getByText(/Nothing is connected to this account yet/i),
        ).toBeInTheDocument();
    });
});

describe('disconnecting', () => {
    it('never offers to remove the credential, which is the only way in', () => {
        renderSection([CREDENTIAL]);
        expect(
            screen.queryByRole('button', {
                name: 'Disconnect Email and password',
            }),
        ).not.toBeInTheDocument();
        expect(screen.getByText('Required')).toBeInTheDocument();
    });

    it('offers to remove a connection the API says can go', async () => {
        renderSection([CREDENTIAL, SLACK]);
        await userEvent.click(
            screen.getByRole('button', { name: 'Disconnect Slack' }),
        );
        // The provider VALUE, not the label: the label is advisory display text
        // and the route is keyed on the canonical value.
        expect(disconnect).toHaveBeenCalledWith('SLACK');
    });

    it('reads canDisconnect, not the provider name', () => {
        // A flag flipped by the server has to change the UI. Branching on
        // "is it the credential one" here would ignore the server's answer.
        renderSection([{ ...CREDENTIAL, canDisconnect: true }]);
        expect(
            screen.getByRole('button', { name: 'Disconnect Email and password' }),
        ).toBeInTheDocument();
    });
});
