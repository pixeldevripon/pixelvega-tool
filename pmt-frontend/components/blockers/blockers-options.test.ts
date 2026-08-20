import { describe, expect, it } from 'vitest';

import {
    BLOCKER_SEVERITY_OPTIONS,
    BLOCKER_STATUS_OPTIONS,
} from '@/components/blockers/blockers-options';

/**
 * The filter option lists, pinned against the backend enums.
 *
 * These labels duplicate the API's own `{ value, label }`, which is a compromise
 * taken to avoid an extra request per list screen for values that change only
 * when the schema does. The cost of that compromise is exactly this defect:
 * `SEVERITY_OPTIONS` shipped with a fourth member, `CRITICAL`, copied from
 * `ProjectPriority` which does have one. `BlockerSeverity` does not, so
 * selecting it sent `?severity=CRITICAL` and `@IsEnum` answered 400. The filter
 * looked available and broke the screen.
 *
 * The expected sets below are transcribed from
 * `pmt-backend/prisma/enums.prisma`. A schema change has to be made in two
 * places, and this test is the second one, so the drift is a failing test rather
 * than a dead control.
 */

describe('blocker filter options', () => {
    it('offers exactly the three BlockerSeverity members', () => {
        expect(BLOCKER_SEVERITY_OPTIONS.map((o) => o.value).sort()).toEqual([
            'HIGH',
            'LOW',
            'MEDIUM',
        ]);
    });

    it('does not offer CRITICAL, which is a project priority and not a severity', () => {
        expect(
            BLOCKER_SEVERITY_OPTIONS.some((o) => o.value === 'CRITICAL'),
        ).toBe(false);
    });

    it('offers exactly the three BlockerStatus members', () => {
        expect(BLOCKER_STATUS_OPTIONS.map((o) => o.value).sort()).toEqual([
            'IN_PROGRESS',
            'OPEN',
            'RESOLVED',
        ]);
    });

    it('gives every option a label that is not the raw value', () => {
        // A raw enum on screen is the thing `{ value, label, tone }` exists to
        // prevent, and these lists are the one place it could sneak back in.
        for (const option of [
            ...BLOCKER_SEVERITY_OPTIONS,
            ...BLOCKER_STATUS_OPTIONS,
        ]) {
            expect(option.label).not.toBe(option.value);
            expect(option.label.trim()).not.toBe('');
        }
    });
});
