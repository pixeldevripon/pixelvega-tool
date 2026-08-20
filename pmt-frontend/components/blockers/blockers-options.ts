import type { FilterOption } from '@/components/common/filter-select';

/**
 * The blockers screen's filter options.
 *
 * Their own module so `blockers-options.test.ts` can pin them against the
 * backend enums. They were inline in the list view, where nothing could assert
 * them, and one of them was wrong: a fourth severity, `CRITICAL`, copied from
 * `ProjectPriority`. `BlockerSeverity` has three members, so selecting it sent a
 * value `@IsEnum(BlockerSeverity)` answers 400 for.
 *
 * Transcribed from `pmt-backend/prisma/enums.prisma`. Changing the schema means
 * changing this file and its test.
 */

export const BLOCKER_STATUS_OPTIONS: FilterOption[] = [
    { value: 'OPEN', label: 'Open' },
    { value: 'IN_PROGRESS', label: 'Being worked on' },
    { value: 'RESOLVED', label: 'Resolved' },
];

export const BLOCKER_SEVERITY_OPTIONS: FilterOption[] = [
    { value: 'HIGH', label: 'High' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'LOW', label: 'Low' },
];
