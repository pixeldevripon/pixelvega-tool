import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ProjectPriority, ProjectStatus } from '@prisma/client';

import {
  QueryProjectsDto,
  UpdateProjectPriorityDto,
  UpdateProjectStatusDto,
} from '@/projects/dto/project.dto';
import { CreateLeaveRequestDto } from '@/leave/dto/leave.dto';
import * as FieldLength from '@/common/constants/field-lengths';

/**
 * The DTO is the specification (D5), so these assert against the real DTOs
 * rather than a stand-in. Each is a rule a service also enforces; the point is
 * that the contract now states it and `/api/docs` shows it.
 */
function check<T extends object>(
  cls: new () => T,
  raw: Record<string, unknown>,
) {
  return validateSync(plainToInstance(cls, raw));
}

function propertiesInError(errors: ReturnType<typeof validateSync>) {
  return errors.map((e) => e.property);
}

describe('conditional requiredness', () => {
  describe('UpdateProjectStatusDto.reason', () => {
    it.each([ProjectStatus.ON_HOLD, ProjectStatus.CANCELLED])(
      'is required when moving to %s',
      (status) => {
        expect(
          propertiesInError(check(UpdateProjectStatusDto, { status })),
        ).toEqual(['reason']);
      },
    );

    it('is not required for any other status', () => {
      expect(
        check(UpdateProjectStatusDto, { status: ProjectStatus.IN_PROGRESS }),
      ).toHaveLength(0);
    });

    it('is accepted when supplied', () => {
      expect(
        check(UpdateProjectStatusDto, {
          status: ProjectStatus.ON_HOLD,
          reason: 'Waiting on client assets',
        }),
      ).toHaveLength(0);
    });

    it('is still length checked when supplied on a status that does not need it', () => {
      // The half of the predicate that a bare trigger check would miss: an
      // over-long reason must not slip through just because it was optional.
      const errors = check(UpdateProjectStatusDto, {
        status: ProjectStatus.IN_PROGRESS,
        reason: 'x'.repeat(FieldLength.LONG_TEXT + 1),
      });
      expect(propertiesInError(errors)).toEqual(['reason']);
    });

    it('rejects a whitespace only reason', () => {
      expect(
        propertiesInError(
          check(UpdateProjectStatusDto, {
            status: ProjectStatus.ON_HOLD,
            reason: '   ',
          }),
        ),
      ).toEqual(['reason']);
    });
  });

  describe('UpdateProjectPriorityDto.rushReason', () => {
    it.each([ProjectPriority.URGENT, ProjectPriority.CRITICAL])(
      'is required at %s',
      (priority) => {
        expect(
          propertiesInError(check(UpdateProjectPriorityDto, { priority })),
        ).toEqual(['rushReason']);
      },
    );

    it.each([
      ProjectPriority.LOW,
      ProjectPriority.MEDIUM,
      ProjectPriority.HIGH,
    ])('is not required at %s', (priority) => {
      expect(check(UpdateProjectPriorityDto, { priority })).toHaveLength(0);
    });

    it('rejects a whitespace only rushReason, because it is not a reason', () => {
      expect(
        propertiesInError(
          check(UpdateProjectPriorityDto, {
            priority: ProjectPriority.URGENT,
            rushReason: '  \t ',
          }),
        ),
      ).toEqual(['rushReason']);
    });
  });
});

describe('date ranges', () => {
  it('rejects a leave request that ends before it starts', () => {
    const errors = check(CreateLeaveRequestDto, {
      leaveTypeId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      startDate: '2026-08-12',
      endDate: '2026-08-10',
    });
    expect(propertiesInError(errors)).toContain('endDate');
  });

  it('accepts a single day leave request', () => {
    expect(
      check(CreateLeaveRequestDto, {
        leaveTypeId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        startDate: '2026-08-12',
        endDate: '2026-08-12',
      }),
    ).toHaveLength(0);
  });
});

describe('boolean query params', () => {
  it('parses ?archived=false as false, not true', () => {
    // The bug @ToBoolean replaced: this returned archived projects.
    const parsed = plainToInstance(QueryProjectsDto, { archived: 'false' });
    expect(parsed.archived).toBe(false);
  });

  it('parses ?archived=true as true', () => {
    expect(
      plainToInstance(QueryProjectsDto, { archived: 'true' }).archived,
    ).toBe(true);
  });
});

describe('length bounds', () => {
  it('rejects a search term past the short text bound', () => {
    const errors = check(QueryProjectsDto, {
      search: 'x'.repeat(FieldLength.SHORT_TEXT + 1),
    });
    expect(propertiesInError(errors)).toEqual(['search']);
  });

  it('accepts one exactly at the bound', () => {
    expect(
      check(QueryProjectsDto, { search: 'x'.repeat(FieldLength.SHORT_TEXT) }),
    ).toHaveLength(0);
  });
});

describe('sorting', () => {
  it('rejects a sort column that is not on the allowlist', () => {
    // Without this an unknown column reaches Prisma and throws a 500.
    expect(
      propertiesInError(check(QueryProjectsDto, { sortBy: 'password' })),
    ).toEqual(['sortBy']);
  });

  it('rejects an unknown sort direction rather than silently ignoring it', () => {
    expect(
      propertiesInError(check(QueryProjectsDto, { sortOrder: 'ASC' })),
    ).toEqual(['sortOrder']);
  });

  it('accepts the allowlisted columns', () => {
    expect(
      check(QueryProjectsDto, { sortBy: 'deadline', sortOrder: 'desc' }),
    ).toHaveLength(0);
  });
});
