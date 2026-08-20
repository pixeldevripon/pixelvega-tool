/**
 * The one rule the seed's soft delete pass must never break.
 *
 * `UsersService.remove` refuses to delete a SYSTEM_ADMIN, and
 * `ProfilesService.deleteOwnAccount` refuses through the same predicate its
 * `canDeleteAccount` flag is built from. Both exist because there must always be
 * a root account. The seed writes `deletedAt` directly, so it is the one path in
 * this codebase that could produce the state those two refuse to, and it would
 * do it silently, in a script nobody watches the output of.
 */

// better-auth ships ESM that Jest's CJS transform cannot parse, and this spec
// covers a pure function that never touches it. jest.mock is hoisted, so the
// module is never evaluated.
jest.mock('better-auth/crypto', () => ({
  hashPassword: jest.fn().mockResolvedValue('hash'),
}));

import { Role, UserStatus } from '@prisma/client';
import { softDeletableUsers, type SeededUser } from '../users';

function seeded(
  id: string,
  role: Role,
  overrides: Partial<SeededUser> = {},
): SeededUser {
  return {
    id,
    email: `${id}@pixelvega.com`,
    name: id,
    role,
    status: UserStatus.ACTIVE,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

const ROOT = seeded('root', Role.SYSTEM_ADMIN);
const ADMIN = seeded('admin', Role.ADMIN);
const MANAGER = seeded('manager', Role.PROJECT_MANAGER);
const DEVELOPER = seeded('developer', Role.DEVELOPER);
const DESIGNER = seeded('designer', Role.DESIGNER);
const CLIENT = seeded('client', Role.CLIENT);

const EVERYONE = [ROOT, ADMIN, MANAGER, DEVELOPER, DESIGNER, CLIENT];

function idsOf(result: { staff: SeededUser[]; clients: SeededUser[] }) {
  return [...result.staff, ...result.clients].map((user) => user.id);
}

describe('softDeletableUsers', () => {
  it('never returns the root account, even when nothing is protected', () => {
    // The empty set is the point: with no protected ids at all, the role rule
    // alone still has to keep the root account out.
    expect(idsOf(softDeletableUsers(EVERYONE, new Set()))).not.toContain(
      ROOT.id,
    );
  });

  it('never returns the root account when it is the only user', () => {
    expect(softDeletableUsers([ROOT], new Set())).toEqual({
      staff: [],
      clients: [],
    });
  });

  it('returns only developers, designers and clients', () => {
    expect(idsOf(softDeletableUsers(EVERYONE, new Set()))).toEqual([
      DEVELOPER.id,
      DESIGNER.id,
      CLIENT.id,
    ]);
  });

  it('keeps admins and project managers out, so no project loses its manager', () => {
    const ids = idsOf(softDeletableUsers(EVERYONE, new Set()));
    expect(ids).not.toContain(ADMIN.id);
    expect(ids).not.toContain(MANAGER.id);
  });

  it('excludes every protected id', () => {
    const result = softDeletableUsers(
      EVERYONE,
      new Set([DEVELOPER.id, CLIENT.id]),
    );
    expect(idsOf(result)).toEqual([DESIGNER.id]);
  });

  it('splits staff from clients, because the two are sampled separately', () => {
    const result = softDeletableUsers(EVERYONE, new Set());
    expect(result.staff.map((user) => user.id)).toEqual([
      DEVELOPER.id,
      DESIGNER.id,
    ]);
    expect(result.clients.map((user) => user.id)).toEqual([CLIENT.id]);
  });

  it('leaves the input array alone', () => {
    const input = [...EVERYONE];
    softDeletableUsers(input, new Set([DEVELOPER.id]));
    expect(input).toEqual(EVERYONE);
  });
});
