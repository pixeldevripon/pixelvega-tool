import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ProfileDropdown, { type HeaderUser } from './user-profile-dropdown';

const push = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push, replace, refresh }),
    usePathname: () => '/',
}));

// better-auth's client calls the success callback itself; this stands in for it
// so the ORDER of what happens after a successful sign-out can be asserted.
const signOut = vi.fn(
    async (options?: { fetchOptions?: { onSuccess?: () => void } }) => {
        options?.fetchOptions?.onSuccess?.();
    },
);
vi.mock('@/lib/auth-client', () => ({ signOut: (...args: never[]) => signOut(...args) }));

const user: HeaderUser = {
    name: 'Rezina Akter',
    email: 'pm@pixelvega.com',
    role: { value: 'PROJECT_MANAGER', label: 'Project manager', tone: 'default' },
    status: { value: 'ACTIVE', label: 'Active', tone: 'success' },
    image: null,
};

function renderMenu(overrides: Partial<HeaderUser> = {}) {
    const queryClient = new QueryClient();
    const clear = vi.spyOn(queryClient, 'clear');
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
    const result = render(
        <ProfileDropdown loggedInUser={{ ...user, ...overrides }} />,
        { wrapper },
    );
    return { ...result, clear };
}

const openMenu = async () => {
    await userEvent.click(
        screen.getByRole('button', { name: 'Open the account menu' }),
    );
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('the trigger', () => {
    it('is the avatar and nothing else, with a name for a screen reader', () => {
        renderMenu();

        expect(
            screen.getByRole('button', { name: 'Open the account menu' }),
        ).toBeInTheDocument();
    });

    it('falls back to the initial when there is no photograph', () => {
        renderMenu({ image: null });

        // Both the trigger and the identity block carry one.
        expect(screen.getAllByText('R').length).toBeGreaterThan(0);
    });

    it('colours the presence dot from the tone the API sent', () => {
        const { container } = renderMenu();

        expect(
            container.querySelector('[data-slot="avatar-badge"]')?.className,
        ).toContain('bg-success-solid');
    });

    it('draws no presence dot at all when the session carried no status', () => {
        // A hardcoded green dot is the same defect as a hardcoded capability
        // flag: it asserts a state nobody checked.
        const { container } = renderMenu({ status: undefined });

        expect(
            container.querySelector('[data-slot="avatar-badge"]'),
        ).toBeNull();
    });
});

describe('the menu', () => {
    it('opens with the identity block', async () => {
        renderMenu();
        await openMenu();

        expect(screen.getByText('Rezina Akter')).toBeInTheDocument();
        expect(screen.getByText('pm@pixelvega.com')).toBeInTheDocument();
    });

    it('links to the one authenticated route that exists', async () => {
        renderMenu();
        await openMenu();

        expect(screen.getByRole('menuitem', { name: /my account/i })).toHaveAttribute(
            'href',
            '/account',
        );
    });

    it('names the account rather than showing an empty line for a user with no name', async () => {
        renderMenu({ name: undefined });
        await openMenu();

        expect(screen.getByText('Your account')).toBeInTheDocument();
    });
});

describe('signing out', () => {
    it('clears the cache BEFORE it navigates', async () => {
        // Order matters: leaving the cache would let the next person to sign in
        // on this browser see the previous session's rows for a frame.
        const { clear } = renderMenu();
        await openMenu();

        await userEvent.click(screen.getByRole('menuitem', { name: /sign out/i }));

        expect(signOut).toHaveBeenCalledTimes(1);
        expect(clear).toHaveBeenCalledTimes(1);
        expect(clear.mock.invocationCallOrder[0]).toBeLessThan(
            replace.mock.invocationCallOrder[0],
        );
    });

    it('REPLACES rather than pushes, so Back cannot return to the signed-out app', async () => {
        renderMenu();
        await openMenu();

        await userEvent.click(screen.getByRole('menuitem', { name: /sign out/i }));

        expect(replace).toHaveBeenCalledWith('/login');
        expect(push).not.toHaveBeenCalled();
    });
});

describe('the profile shortcut', () => {
    it('jumps to the profile on Cmd+/', async () => {
        renderMenu();

        await userEvent.keyboard('{Meta>}/{/Meta}');

        expect(push).toHaveBeenCalledWith('/account');
    });

    it('leaves Cmd+H to the operating system', async () => {
        // It used to preventDefault() on macOS's Hide Window and open the
        // dashboard root in a new tab instead.
        renderMenu();

        await userEvent.keyboard('{Meta>}h{/Meta}');

        expect(push).not.toHaveBeenCalled();
    });
});
