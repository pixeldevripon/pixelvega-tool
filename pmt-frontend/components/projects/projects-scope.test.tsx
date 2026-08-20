import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PROJECT_ROWS } from '@/fixtures/projects';
import { Permission, type PermissionKey } from '@/lib/config/rbac';

/**
 * Which list the screen reads, and in which shape.
 *
 * This is the highest-consequence branch in the projects screen. Getting it
 * wrong in one direction answers 403 to most of the company; in the other it
 * asks for the internal shape on a client's behalf and then renders whatever
 * came back. Both have happened here: the screen shipped calling `/projects`
 * unconditionally, which 403s for every developer, designer and client, and the
 * client's response carries no `priority` or `members`, so the internal list
 * would have thrown on it.
 */

const { listMock, listMineMock, listAsClientMock } = vi.hoisted(() => ({
    listMock: vi.fn(),
    listMineMock: vi.fn(),
    listAsClientMock: vi.fn(),
}));

vi.mock('@/lib/api/projects', () => ({
    projectsApi: {
        list: listMock,
        listMine: listMineMock,
        listAsClient: listAsClientMock,
    },
}));

/**
 * `useTableState` reads the URL, and `useSearchParams` returns null outside a
 * Next router. The search string is settable so a case can start from a URL.
 */
let currentSearch = '';

vi.mock('next/navigation', () => ({
    usePathname: () => '/projects',
    useSearchParams: () => new URLSearchParams(currentSearch),
}));

const grantedPermissions = { current: [] as PermissionKey[] };

vi.mock('@/contexts/role-context', () => ({
    useRole: () => ({
        role: null,
        permissions: grantedPermissions.current,
        can: (permission: PermissionKey) =>
            grantedPermissions.current.includes(permission),
        canAny: (perms: PermissionKey[]) =>
            perms.some((p) => grantedPermissions.current.includes(p)),
        canAll: (perms: PermissionKey[]) =>
            perms.every((p) => grantedPermissions.current.includes(p)),
    }),
}));

// Imported after the mocks so the component picks them up.
const { ProjectsView } = await import(
    '@/components/projects/projects-view'
);

const CLIENT_PROJECT = {
    id: 'c1',
    name: 'Client visible project',
    description: null,
    status: { value: 'IN_PROGRESS', label: 'In progress', tone: 'info' },
    projectTypeTags: [
        { type: { value: 'WEBFLOW', label: 'Webflow', tone: 'default' } },
    ],
    plannedStartDate: '2026-01-05T00:00:00.000Z',
    deadline: '2026-04-05T00:00:00.000Z',
    completedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
};

function renderAs(permissions: PermissionKey[]) {
    grantedPermissions.current = permissions;
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return render(
        <QueryClientProvider client={client}>
            <ProjectsView />
        </QueryClientProvider>,
    );
}

beforeEach(() => {
    currentSearch = '';
    listMock.mockReset().mockResolvedValue({
        items: PROJECT_ROWS,
        total: PROJECT_ROWS.length,
        page: 1,
        pageSize: 20,
    });
    listMineMock.mockReset().mockResolvedValue({
        items: PROJECT_ROWS.slice(0, 2),
        total: 2,
        page: 1,
        pageSize: 20,
    });
    listAsClientMock.mockReset().mockResolvedValue({
        items: [CLIENT_PROJECT],
        total: 1,
        page: 1,
        pageSize: 20,
    });
});

describe('an admin or project manager', () => {
    it('reads the whole company list', async () => {
        renderAs([Permission.VIEW_ALL_PROJECTS, Permission.VIEW_PROJECT_MEMBERS]);

        await waitFor(() => expect(listMock).toHaveBeenCalled());
        expect(listMineMock).not.toHaveBeenCalled();
        expect(listAsClientMock).not.toHaveBeenCalled();
    });

    it('asks the API to sort, and defaults to newest first', async () => {
        renderAs([Permission.VIEW_ALL_PROJECTS, Permission.VIEW_PROJECT_MEMBERS]);

        // The VALUE it was called with. `/projects` has no priority-order
        // default, so a column has to be named or the list is arbitrary.
        await waitFor(() =>
            expect(listMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    sortBy: 'createdAt',
                    sortOrder: 'desc',
                }),
            ),
        );
    });
});

describe('a developer or designer', () => {
    it('reads the membership-scoped list, never the company one', async () => {
        // Calling `/projects` here is a 403, which the screen used to do.
        renderAs([Permission.VIEW_PROJECT_MEMBERS, Permission.VIEW_OWN_PROJECTS]);

        await waitFor(() => expect(listMineMock).toHaveBeenCalled());
        expect(listMock).not.toHaveBeenCalled();
        expect(listAsClientMock).not.toHaveBeenCalled();
    });

    it('leaves the sort column unset, asking for priority order', async () => {
        renderAs([Permission.VIEW_PROJECT_MEMBERS, Permission.VIEW_OWN_PROJECTS]);

        await waitFor(() =>
            expect(listMineMock).toHaveBeenCalledWith(
                expect.objectContaining({ sortBy: undefined }),
            ),
        );
    });

    it('still gets the three views', async () => {
        renderAs([Permission.VIEW_PROJECT_MEMBERS, Permission.VIEW_OWN_PROJECTS]);

        await waitFor(() =>
            expect(
                screen.getByRole('group', { name: 'Project view' }),
            ).toBeInTheDocument(),
        );
    });
});

describe('a client', () => {
    const asClient = () => renderAs([Permission.VIEW_OWN_PROJECTS]);

    it('reads the reduced list and neither internal one', async () => {
        asClient();

        await waitFor(() => expect(listAsClientMock).toHaveBeenCalled());
        // Not merely "did not render internal fields": it must not ASK for the
        // internal shape on a client's behalf at all.
        expect(listMock).not.toHaveBeenCalled();
        expect(listMineMock).not.toHaveBeenCalled();
    });

    it('sends only paging, because every other filter is ignored for them', async () => {
        asClient();

        await waitFor(() =>
            expect(listAsClientMock).toHaveBeenCalledWith({
                page: 1,
                pageSize: 20,
            }),
        );
    });

    it('gets no view switcher and no filters', async () => {
        asClient();

        await waitFor(() =>
            expect(screen.getByText('Client visible project')).toBeInTheDocument(),
        );
        // The board and the timeline both group by the manager carrying the
        // work, which is not a client's business.
        expect(
            screen.queryByRole('group', { name: 'Project view' }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByLabelText('Search projects'),
        ).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
    });

    it('renders their project without any internal figure', async () => {
        asClient();

        await waitFor(() =>
            expect(screen.getByText('Client visible project')).toBeInTheDocument(),
        );

        // No priority, no hours, no team, no overdue verdict.
        for (const internal of [
            /Critical|Urgent|High|Medium|Low/,
            /\d+h( \d+m)?/,
            /overdue/i,
            /Nobody staffed/,
        ]) {
            expect(screen.queryByText(internal)).not.toBeInTheDocument();
        }
    });
});
