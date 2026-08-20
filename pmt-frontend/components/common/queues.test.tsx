import { render, screen } from '@testing-library/react';
import type { ColumnDef } from '@tanstack/react-table';
import { describe, expect, it } from 'vitest';

import { auditLogsColumns } from '@/components/audit-logs/audit-logs-columns';
import { blockersColumns } from '@/components/blockers/blockers-columns';
import {
    AUDIT_ROWS,
    BLOCKER_ROWS,
    LEAVE_ROWS,
    USER_ROWS,
} from '@/components/common/queues.fixture';
import { DataTable } from '@/components/data-table/data-table';
import { leaveColumns } from '@/components/leave/leave-columns';
import { usersColumns } from '@/components/users/users-columns';
import type { AuditLogEntry } from '@/types/audit-logs';
import type { Blocker } from '@/types/blockers';
import type { LeaveRequest } from '@/types/leave';
import type { User } from '@/types/users';

/**
 * The four cross-project queues.
 *
 * What these pin is the part a passing typecheck cannot: that each column reads
 * a field the API really sends. Two of them did not, and only a real payload
 * showed it. `leave.user.role` arrived as the bare string "DEVELOPER", so a cell
 * reading `.label` rendered nothing, and `audit.actionLabel` did not exist at
 * all. Both fixtures below are captured responses, so a column reading an
 * invented field fails here rather than rendering an empty cell in production.
 */

function renderQueue<T>(columns: ColumnDef<T>[], data: T[]) {
    return render(
        <DataTable
            columns={columns as never}
            data={data}
            empty={{ title: 'nothing here' }}
            getRowId={(row) => (row as { id: string }).id}
        />,
    );
}

describe('every queue renders every row it was given', () => {
    it.each([
        ['blockers', blockersColumns, BLOCKER_ROWS],
        ['team', usersColumns, USER_ROWS],
        ['leave', leaveColumns, LEAVE_ROWS],
        ['audit log', auditLogsColumns, AUDIT_ROWS],
    ] as const)('%s', (_name, columns, rows) => {
        const { container } = renderQueue(columns as never, rows as never);

        // One body row per record. A column that throws takes the row with it,
        // and a silently short table looks like a filter working.
        expect(container.querySelectorAll('tbody tr')).toHaveLength(
            rows.length,
        );
    });

    it('shows the empty state rather than a bare table', () => {
        renderQueue(blockersColumns, []);
        expect(screen.getByText('nothing here')).toBeInTheDocument();
    });
});

describe('no queue offers a sortable header', () => {
    it.each([
        ['blockers', blockersColumns],
        ['team', usersColumns],
        ['leave', leaveColumns],
        ['audit log', auditLogsColumns],
    ] as const)('%s', (_name, columns) => {
        // The API sorts before it pages. A sortable header would re-order the
        // twenty rows it was handed and present them as the first twenty by
        // that column, which is a different and wrong answer.
        for (const column of columns) {
            expect(column.enableSorting).toBe(false);
        }
    });
});

describe('blockers', () => {
    it('reads the age phrased by the API, not a countdown of its own', () => {
        const open = BLOCKER_ROWS.find((row) => !row.isResolved) as Blocker;
        renderQueue(blockersColumns, [open]);

        expect(screen.getByText(open.ageLabel)).toBeInTheDocument();
    });

    it('shows how long a resolved blocker took, not how old it is', () => {
        // An age still ticking on a closed blocker reads as live work.
        //
        // The two labels are set explicitly rather than taken from the fixture:
        // there they happen to be the same string, because a blocker resolved
        // at the moment it was last measured has an age equal to its resolution
        // time, and asserting one is absent would then be asserting against
        // identical text.
        renderQueue(blockersColumns, [
            {
                ...BLOCKER_ROWS[0],
                isResolved: true,
                ageLabel: '99h 99m',
                resolutionLabel: '2h 15m',
            } as Blocker,
        ]);

        expect(screen.getByText('2h 15m')).toBeInTheDocument();
        expect(screen.queryByText('99h 99m')).not.toBeInTheDocument();
    });

    it('falls back to an em dash for a resolved blocker with no timing', () => {
        renderQueue(blockersColumns, [
            {
                ...BLOCKER_ROWS[0],
                isResolved: true,
                resolutionLabel: null,
                assignedTo: null,
            } as Blocker,
        ]);

        expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    });

    it('says nobody is assigned instead of leaving the cell blank', () => {
        const unassigned = {
            ...BLOCKER_ROWS[0],
            assignedTo: null,
        } as Blocker;
        renderQueue(blockersColumns, [unassigned]);

        expect(screen.getByText('—')).toBeInTheDocument();
    });
});

describe('team', () => {
    it('renders the role as a badge from the display object', () => {
        const user = USER_ROWS[0] as User;
        renderQueue(usersColumns, [user]);

        expect(screen.getByText(user.role.label)).toBeInTheDocument();
    });

    it('flags a person who has never set a password', () => {
        // The state somebody has to chase, and distinct from being suspended.
        renderQueue(usersColumns, [
            { ...USER_ROWS[0], mustResetPassword: true } as User,
        ]);

        expect(screen.getByText('Password pending')).toBeInTheDocument();
    });

    it('does not flag a person who has set one', () => {
        renderQueue(usersColumns, [
            { ...USER_ROWS[0], mustResetPassword: false } as User,
        ]);

        expect(screen.queryByText('Password pending')).not.toBeInTheDocument();
    });
});

describe('leave', () => {
    it('renders the requester role, which used to arrive as a bare string', () => {
        const withRole = LEAVE_ROWS.find(
            (row) => row.user?.role,
        ) as LeaveRequest;
        renderQueue(leaveColumns, [withRole]);

        expect(
            screen.getByText(withRole.user!.role!.label),
        ).toBeInTheDocument();
    });

    it('prints the day count from the API rather than counting the range', () => {
        // Counting it here is a second implementation of the same rule, and the
        // two would disagree about weekends and public holidays.
        const request = { ...LEAVE_ROWS[0], days: 4 } as LeaveRequest;
        renderQueue(leaveColumns, [request]);

        expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('collapses a one-day leave to a single date', () => {
        // "Dec 21, 2026 to Dec 21, 2026" parses as a mistake before it parses
        // as a range.
        renderQueue(leaveColumns, [
            {
                ...LEAVE_ROWS[0],
                startDate: '2026-12-21',
                endDate: '2026-12-21',
            } as LeaveRequest,
        ]);

        expect(screen.queryByText('to')).not.toBeInTheDocument();
    });

    it('shows a range when the dates differ', () => {
        renderQueue(leaveColumns, [
            {
                ...LEAVE_ROWS[0],
                startDate: '2026-12-21',
                endDate: '2026-12-24',
            } as LeaveRequest,
        ]);

        expect(screen.getByText('to')).toBeInTheDocument();
    });

    it('says a pending request is waiting rather than showing an empty reviewer', () => {
        renderQueue(leaveColumns, [
            { ...LEAVE_ROWS[0], isPending: true } as LeaveRequest,
        ]);

        expect(screen.getByText('Waiting')).toBeInTheDocument();
    });
});

describe('audit log', () => {
    it('shows the readable label AND the exact action', () => {
        // The label is for reading; the exact value is what somebody quotes or
        // filters on. Both, because neither replaces the other.
        const entry = AUDIT_ROWS[0] as AuditLogEntry;
        renderQueue(auditLogsColumns, [entry]);

        expect(screen.getByText(entry.actionLabel)).toBeInTheDocument();
        expect(screen.getByText(entry.action)).toBeInTheDocument();
    });

    it('calls an entry with no target a system action', () => {
        // Both target columns are nullable, and the DTO used to claim they
        // were not.
        renderQueue(auditLogsColumns, [
            {
                ...AUDIT_ROWS[0],
                targetType: null,
                targetId: null,
            } as AuditLogEntry,
        ]);

        expect(screen.getByText('System')).toBeInTheDocument();
    });

    it('renders metadata as flat pairs without interpreting it', () => {
        renderQueue(auditLogsColumns, [
            {
                ...AUDIT_ROWS[0],
                metadata: { role: 'CLIENT', revoked: 3 },
            } as unknown as AuditLogEntry,
        ]);

        expect(screen.getByText('role:')).toBeInTheDocument();
        expect(screen.getByText('CLIENT')).toBeInTheDocument();
        expect(screen.getByText('revoked:')).toBeInTheDocument();
    });

    it('does not throw on a nested metadata value', () => {
        // Free form and shaped per action by whatever emitted it. A renderer
        // that assumes flat strings breaks on the one action nobody tested.
        renderQueue(auditLogsColumns, [
            {
                ...AUDIT_ROWS[0],
                metadata: {
                    changes: { status: { from: 'INVITED', to: 'ACTIVE' } },
                },
            } as unknown as AuditLogEntry,
        ]);

        expect(screen.getByText('changes:')).toBeInTheDocument();
        expect(
            screen.getByText(/"from":"INVITED"/),
        ).toBeInTheDocument();
    });

    it('summarises rather than printing a long metadata object in full', () => {
        renderQueue(auditLogsColumns, [
            {
                ...AUDIT_ROWS[0],
                metadata: { a: 1, b: 2, c: 3, d: 4, e: 5 },
            } as unknown as AuditLogEntry,
        ]);

        expect(screen.getByText('+2 more')).toBeInTheDocument();
    });

    it('shows an em dash for no metadata at all', () => {
        renderQueue(auditLogsColumns, [
            { ...AUDIT_ROWS[0], metadata: null } as AuditLogEntry,
        ]);

        expect(screen.getByText('—')).toBeInTheDocument();
    });
});
