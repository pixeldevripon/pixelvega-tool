import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RoleProvider, useRole, type EnumDisplay } from '@/contexts/role-context';
import { Permission, ROLE_PERMISSIONS, type PermissionKey } from '@/lib/config/rbac';

/**
 * The permission gate the whole UI reads from, which had no test.
 *
 * ── Where this came from ──
 *
 * Salvaged from `refactor/phase-7-frontend-foundations`, never merged. That
 * provider FETCHED its permissions, so its cases for the loading window and a
 * failed request were dropped: this one takes them as props and the layout does
 * the fetching. Everything about what the set MEANS still applies, and the
 * fallback and the deny-all default are this implementation's own.
 *
 * ── Why any of this matters when gating is only UX ──
 *
 * It is. The API refuses regardless, so nothing here is a security boundary
 * (D2). What a bug here costs is a screen that offers a button the server then
 * answers 403 to, or hides one the person is entitled to, and the second is the
 * kind nobody reports: they just assume they cannot do it.
 */

const ADMIN_ROLE: EnumDisplay = {
    value: 'ADMIN',
    label: 'Admin',
    tone: 'default',
};

/** Renders what the hook reports, so a case can assert on the DOM. */
function Probe({ ask }: { ask: PermissionKey[] }) {
    const { role, permissions, can, canAny, canAll } = useRole();

    return (
        <div>
            <span data-testid='role-label'>{role?.label ?? 'no role'}</span>
            <span data-testid='role-value'>{role?.value ?? 'none'}</span>
            <span data-testid='count'>{permissions.length}</span>
            <span data-testid='can'>{String(can(ask[0]))}</span>
            <span data-testid='can-any'>{String(canAny(ask))}</span>
            <span data-testid='can-all'>{String(canAll(ask))}</span>
        </div>
    );
}

const read = (id: string) => screen.getByTestId(id).textContent;

describe('the permissions the API returned', () => {
    it('grants exactly those and nothing else', () => {
        render(
            <RoleProvider
                role={ADMIN_ROLE}
                permissions={[Permission.VIEW_ALL_PROJECTS]}>
                <Probe ask={[Permission.VIEW_ALL_PROJECTS]} />
            </RoleProvider>,
        );

        expect(read('count')).toBe('1');
        expect(read('can')).toBe('true');
    });

    it('refuses a permission the API did not return', () => {
        render(
            <RoleProvider
                role={ADMIN_ROLE}
                permissions={[Permission.VIEW_ALL_PROJECTS]}>
                <Probe ask={[Permission.DELETE_USER]} />
            </RoleProvider>,
        );

        expect(read('can')).toBe('false');
    });

    it('honours an EXPLICIT empty set instead of falling back to the role', () => {
        // The distinction the implementation turns on: `permissions !==
        // undefined`. An empty array is an answer ("this session may do
        // nothing"), and treating it as "not asked yet" would silently hand an
        // admin every permission their role has.
        render(
            <RoleProvider role={ADMIN_ROLE} permissions={[]}>
                <Probe ask={[Permission.VIEW_ALL_PROJECTS]} />
            </RoleProvider>,
        );

        expect(read('count')).toBe('0');
        expect(read('can')).toBe('false');
    });

    it('keeps a permission this client has never heard of', () => {
        // The set is `Set<string>`, not `Set<PermissionKey>`, deliberately. The
        // API is the authority on what capabilities exist; if it grows one
        // before `lib/config/rbac.ts` catches up, the string still matches. A
        // client that filtered to its own union would start refusing things the
        // server granted.
        render(
            <RoleProvider
                role={ADMIN_ROLE}
                permissions={['INVENT_A_NEW_CAPABILITY']}>
                <Probe ask={['INVENT_A_NEW_CAPABILITY' as PermissionKey]} />
            </RoleProvider>,
        );

        expect(read('can')).toBe('true');
    });
});

describe('the static fallback', () => {
    it('uses the role map when no permissions arrived', () => {
        // For the window before the request answers, or when it failed. The
        // server's answer always wins when we have one.
        render(
            <RoleProvider role={ADMIN_ROLE}>
                <Probe ask={[Permission.VIEW_ALL_PROJECTS]} />
            </RoleProvider>,
        );

        expect(read('count')).toBe(
            String(ROLE_PERMISSIONS[ADMIN_ROLE.value as 'ADMIN'].length),
        );
        expect(read('can')).toBe('true');
    });

    it('denies everything when there is no role either', () => {
        render(
            <RoleProvider>
                <Probe ask={[Permission.VIEW_ALL_PROJECTS]} />
            </RoleProvider>,
        );

        expect(read('count')).toBe('0');
        expect(read('can')).toBe('false');
    });

    it('denies everything for a role string the map does not know', () => {
        // A role the backend added and this mirror has not. Failing closed is
        // the safe direction: the smaller UI, not a crash and not a wider one.
        render(
            <RoleProvider role={{ value: 'ARCHIVIST', label: 'Archivist', tone: 'default' }}>
                <Probe ask={[Permission.VIEW_ALL_PROJECTS]} />
            </RoleProvider>,
        );

        expect(read('count')).toBe('0');
        expect(read('can')).toBe('false');
    });
});

describe('the role is for display, not for deciding', () => {
    it('exposes the label the server sent', () => {
        render(
            <RoleProvider role={ADMIN_ROLE} permissions={[]}>
                <Probe ask={[Permission.VIEW_ALL_PROJECTS]} />
            </RoleProvider>,
        );

        expect(read('role-label')).toBe('Admin');
    });

    it('keeps the value reachable only through .value', () => {
        // It is the whole object rather than a string precisely so `role ===
        // 'ADMIN'` does not typecheck and `role.value === 'ADMIN'` reads like
        // the deliberate choice it should be.
        render(
            <RoleProvider role={ADMIN_ROLE} permissions={[]}>
                <Probe ask={[Permission.VIEW_ALL_PROJECTS]} />
            </RoleProvider>,
        );

        expect(read('role-value')).toBe('ADMIN');
    });
});

describe('canAny and canAll', () => {
    const held = [Permission.VIEW_ALL_PROJECTS, Permission.EDIT_PROJECT];

    it('canAny is true when one of them is held', () => {
        render(
            <RoleProvider role={ADMIN_ROLE} permissions={held}>
                <Probe ask={[Permission.EDIT_PROJECT, Permission.DELETE_USER]} />
            </RoleProvider>,
        );

        expect(read('can-any')).toBe('true');
    });

    it('canAny is false when none are', () => {
        render(
            <RoleProvider role={ADMIN_ROLE} permissions={held}>
                <Probe ask={[Permission.DELETE_USER, Permission.MANAGE_LEAVE_TYPES]} />
            </RoleProvider>,
        );

        expect(read('can-any')).toBe('false');
    });

    it('canAll is true only when every one is held', () => {
        render(
            <RoleProvider role={ADMIN_ROLE} permissions={held}>
                <Probe ask={held} />
            </RoleProvider>,
        );

        expect(read('can-all')).toBe('true');
    });

    it('canAll is false when one is missing', () => {
        render(
            <RoleProvider role={ADMIN_ROLE} permissions={held}>
                <Probe ask={[...held, Permission.DELETE_USER]} />
            </RoleProvider>,
        );

        expect(read('can-all')).toBe('false');
    });

    it('canAll of NOTHING is false, not vacuously true', () => {
        // `[].every()` is true, which would make `canAll([])` grant a screen
        // that forgot to say what it needs. The implementation guards the length
        // for exactly that.
        function EmptyAsk() {
            const { canAll } = useRole();
            return <span data-testid='empty'>{String(canAll([]))}</span>;
        }

        render(
            <RoleProvider role={ADMIN_ROLE} permissions={held}>
                <EmptyAsk />
            </RoleProvider>,
        );

        expect(screen.getByTestId('empty').textContent).toBe('false');
    });
});

describe('outside a provider', () => {
    it('denies everything rather than throwing', () => {
        // A throw would take down a screen over what is a presentation concern,
        // and denying is the safe direction: a forgotten provider becomes a
        // visible missing control instead of an invisible permission bypass.
        render(<Probe ask={[Permission.VIEW_ALL_PROJECTS]} />);

        expect(read('count')).toBe('0');
        expect(read('can')).toBe('false');
        expect(read('can-any')).toBe('false');
        expect(read('can-all')).toBe('false');
        expect(read('role-label')).toBe('no role');
    });
});
