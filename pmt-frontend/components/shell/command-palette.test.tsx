import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CommandPalette } from './command-palette';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn() }),
}));

const MAC =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const WINDOWS =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

const realUserAgent = window.navigator.userAgent;

function setUserAgent(value: string) {
    Object.defineProperty(window.navigator, 'userAgent', {
        value,
        configurable: true,
    });
}

const role = { value: 'ADMIN', label: 'Admin', tone: 'default' };

beforeEach(() => {
    setUserAgent(MAC);
});

afterEach(() => {
    setUserAgent(realUserAgent);
});

/**
 * The shortcut badge on the trigger.
 *
 * A shortcut nobody can see is a shortcut nobody uses, and the modifier is not
 * knowable during a server render, so the badge is set in an effect. These cases
 * pin both halves: the right glyph per platform, and nothing at all before the
 * effect has run.
 */
describe('the command palette trigger', () => {
    it('advertises the command glyph on a Mac', async () => {
        render(<CommandPalette userRole={role} userPermissions={[]} />);

        await waitFor(() => expect(screen.getByText('⌘')).toBeInTheDocument());
        expect(screen.getByText('K')).toBeInTheDocument();
    });

    it('advertises Ctrl on Windows', async () => {
        setUserAgent(WINDOWS);
        render(<CommandPalette userRole={role} userPermissions={[]} />);

        await waitFor(() =>
            expect(screen.getByText('Ctrl')).toBeInTheDocument(),
        );
        expect(screen.queryByText('⌘')).not.toBeInTheDocument();
    });

    it('folds the shortcut into the accessible name, not just the pixels', async () => {
        render(<CommandPalette userRole={role} userPermissions={[]} />);

        await waitFor(() =>
            expect(
                screen.getByRole('button', {
                    name: 'Search the dashboard, ⌘ K',
                }),
            ).toBeInTheDocument(),
        );
    });

    it('renders the badge inside a kbd element', async () => {
        const { container } = render(
            <CommandPalette userRole={role} userPermissions={[]} />,
        );

        await waitFor(() =>
            expect(container.querySelector('kbd')).not.toBeNull(),
        );
        expect(container.querySelector('kbd')?.textContent).toBe('⌘K');
    });
});
