import { ProjectPriority, ProjectRole, ProjectStatus } from '@prisma/client';

import {
  toProjectLead,
  toProjectMemberSummaries,
  toProjectResponse,
  type ProjectMemberRow,
} from '@/projects/project.mapper';
import { ProjectsService } from '@/projects/projects.service';

/**
 * Who counts as ON a project, and which of several managers is THE lead.
 *
 * Both matter because a list groups by the lead. Two clients picking their own
 * answer would group the same project under different people, and a former
 * member appearing on a row claims they are working on something they left.
 */

function member(overrides: Partial<ProjectMemberRow> & { name: string }) {
  return {
    role: overrides.role ?? ProjectRole.DEVELOPER,
    leftAt: overrides.leftAt ?? null,
    user: {
      id: overrides.name.toLowerCase(),
      name: overrides.name,
      avatarUrl: null,
    },
  } satisfies ProjectMemberRow;
}

describe('toProjectMemberSummaries', () => {
  it('puts project managers first, then sorts by name', () => {
    const result = toProjectMemberSummaries([
      member({ name: 'Zoe', role: ProjectRole.DESIGNER }),
      member({ name: 'Bea', role: ProjectRole.DEVELOPER }),
      member({ name: 'Ada', role: ProjectRole.PROJECT_MANAGER }),
      member({ name: 'Abe', role: ProjectRole.DEVELOPER }),
    ]);

    expect(result.map((m) => m.name)).toEqual(['Ada', 'Abe', 'Bea', 'Zoe']);
  });

  it('drops anyone who has left', () => {
    // Someone who left is part of the project's history, which the activity
    // timeline carries. On a row it claims they are working on it now.
    const result = toProjectMemberSummaries([
      member({ name: 'Current' }),
      member({ name: 'Gone', leftAt: new Date('2026-01-01') }),
    ]);

    expect(result.map((m) => m.name)).toEqual(['Current']);
  });

  it('sends the project role as a display object, not a bare enum', () => {
    const [first] = toProjectMemberSummaries([
      member({ name: 'Ada', role: ProjectRole.PROJECT_MANAGER }),
    ]);
    expect(first.projectRole).toEqual({
      value: 'PROJECT_MANAGER',
      label: expect.any(String),
      tone: expect.any(String),
    });
  });

  it('handles an empty team', () => {
    expect(toProjectMemberSummaries([])).toEqual([]);
  });
});

describe('toProjectLead', () => {
  it('is the first staffed project manager by name', () => {
    // A project can have several managers, so "the lead" needs a rule or two
    // clients group the same project under different people. First by name is
    // stable and needs no extra column.
    const members = toProjectMemberSummaries([
      member({ name: 'Zoe', role: ProjectRole.PROJECT_MANAGER }),
      member({ name: 'Ada', role: ProjectRole.PROJECT_MANAGER }),
      member({ name: 'Bea', role: ProjectRole.DEVELOPER }),
    ]);

    expect(toProjectLead(members)?.name).toBe('Ada');
  });

  it('is null when nobody is staffed as a manager', () => {
    // Exactly the state that keeps a project in Planning, so it is a real
    // answer rather than a missing one, and a list groups it under "No lead".
    const members = toProjectMemberSummaries([
      member({ name: 'Bea', role: ProjectRole.DEVELOPER }),
      member({ name: 'Zoe', role: ProjectRole.DESIGNER }),
    ]);

    expect(toProjectLead(members)).toBeNull();
  });

  it('never picks a manager who has left', () => {
    // The filter happens before this runs, but the case is worth pinning: a
    // departed manager as the lead would group live work under someone gone.
    const members = toProjectMemberSummaries([
      member({
        name: 'Gone',
        role: ProjectRole.PROJECT_MANAGER,
        leftAt: new Date('2026-01-01'),
      }),
      member({ name: 'Bea', role: ProjectRole.DEVELOPER }),
    ]);

    expect(toProjectLead(members)).toBeNull();
  });

  it('is null for an empty team', () => {
    expect(toProjectLead([])).toBeNull();
  });
});

describe('toProjectResponse label fields', () => {
  const base = {
    id: 'p1',
    status: ProjectStatus.IN_PROGRESS,
    priority: ProjectPriority.HIGH,
    archivedAt: null,
    deadline: null,
    estimatedHours: null,
    actualHours: 0,
    members: [],
    projectTypeTags: [],
  };

  const context = {
    permissions: [],
    managesProject: false,
  } as unknown as Parameters<typeof toProjectResponse>[1];

  it('reads an hours figure out rather than shipping the raw decimal', () => {
    // The exact number stays available for arithmetic; only the label is for
    // reading (ADR 0003). `56.083333333333336h` on a screen is the defect.
    const response = toProjectResponse(
      { ...base, actualHours: 56.083333333333336, estimatedHours: 114 },
      context,
    );

    expect(response.actualHours).toBe(56.083333333333336);
    expect(response.actualHoursLabel).toBe('56h 5m');
    expect(response.estimatedHoursLabel).toBe('114h');
  });

  it('labels remaining hours as negative once the estimate is passed', () => {
    const response = toProjectResponse(
      { ...base, actualHours: 130, estimatedHours: 120 },
      context,
    );

    expect(response.remainingHours).toBe(-10);
    expect(response.remainingHoursLabel).toBe('-10h');
  });

  it('leaves the estimate labels null when there is no estimate', () => {
    // Null is not "nothing remaining": it is "nobody has said".
    const response = toProjectResponse({ ...base, actualHours: 4 }, context);

    expect(response.estimatedHoursLabel).toBeNull();
    expect(response.remainingHoursLabel).toBeNull();
    // The actual figure is always known, so its label always exists.
    expect(response.actualHoursLabel).toBe('4h');
  });

  it('phrases the deadline against the passed clock, not the real one', () => {
    const now = new Date('2026-08-20T12:00:00.000Z');
    const response = toProjectResponse(
      { ...base, deadline: new Date('2026-09-01T00:00:00.000Z') },
      context,
      now,
    );

    // Whole days between the two dates, so the time of day the request
    // happened to arrive at does not move the count.
    expect(response.daysUntilDeadline).toBe(12);
    expect(response.deadlineLabel).toBe('in 12 days');
  });

  it('phrases an overdue deadline as overdue', () => {
    const response = toProjectResponse(
      { ...base, deadline: new Date('2026-08-15T00:00:00.000Z') },
      context,
      new Date('2026-08-20T12:00:00.000Z'),
    );

    expect(response.isOverdue).toBe(true);
    expect(response.deadlineLabel).toBe('5 days overdue');
  });

  it('still phrases the deadline of a finished project, which is not overdue', () => {
    // The countdown is a fact about the date; overdue is a judgment about the
    // work. A completed project keeps the first and loses the second.
    const response = toProjectResponse(
      {
        ...base,
        status: ProjectStatus.COMPLETED,
        deadline: new Date('2026-08-15T00:00:00.000Z'),
      },
      context,
      new Date('2026-08-20T12:00:00.000Z'),
    );

    expect(response.isOverdue).toBe(false);
    expect(response.deadlineLabel).toBe('5 days overdue');
  });

  it('leaves the deadline label null when there is no deadline', () => {
    expect(toProjectResponse(base, context).deadlineLabel).toBeNull();
  });
});

describe('the two list endpoints share one filter clause', () => {
  /**
   * `/projects` and `/projects/mine` offer the same filters to different
   * audiences. A second copy of the clause is how one of them ends up quietly
   * ignoring `archived`, which would show an archive to somebody who asked for
   * live work. These cases pin the shape both build.
   */
  const build = (query: Record<string, unknown>) =>
    (
      ProjectsService.prototype as unknown as {
        buildProjectFilters: (q: unknown) => Record<string, unknown>;
      }
    ).buildProjectFilters(query);

  it('excludes archived projects unless they were asked for', () => {
    expect(build({}).archivedAt).toBeNull();
    expect(build({ archived: false }).archivedAt).toBeNull();
  });

  it('returns ONLY archived projects when they were, rather than a mix', () => {
    // A dedicated archive view. Mixing both would put cancelled work back in
    // front of somebody triaging live projects.
    expect(build({ archived: true }).archivedAt).toEqual({ not: null });
  });

  it('matches a name case insensitively, anywhere in it', () => {
    expect(build({ search: 'acme' }).name).toEqual({
      contains: 'acme',
      mode: 'insensitive',
    });
  });

  it('omits a filter that was not supplied rather than sending undefined', () => {
    const where = build({});
    expect('status' in where).toBe(false);
    expect('priority' in where).toBe(false);
    expect('name' in where).toBe(false);
  });

  it('matches ANY of several project types, not all of them', () => {
    expect(
      build({ projectTypes: ['WORDPRESS', 'SEO'] }).projectTypeTags,
    ).toEqual({ some: { type: { in: ['WORDPRESS', 'SEO'] } } });
  });

  it('ignores an empty type array instead of matching nothing', () => {
    // `{ in: [] }` matches no rows, so an empty array would silently empty the
    // list rather than being the no-op the caller meant.
    expect('projectTypeTags' in build({ projectTypes: [] })).toBe(false);
  });

  it('honours clientId only where the endpoint accepts it', () => {
    // `QueryMyProjectsDto` has no `clientId`: filtering your own projects by
    // client is a question nobody asks, and accepting it silently would suggest
    // otherwise.
    expect(build({ clientId: 'c1' }).clientId).toBe('c1');
    expect('clientId' in build({})).toBe(false);
  });
});
