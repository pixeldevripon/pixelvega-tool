import { Role, UserStatus, Weekday } from '@prisma/client';

import { toUserResponse } from '../user.mapper';

const base = {
  id: 'u1',
  email: 'rezina@pixelvega.com',
  name: 'Rezina Akter',
  role: Role.DEVELOPER,
  status: UserStatus.ACTIVE,
  weeklyOffDay: Weekday.FRIDAY,
};

describe('toUserResponse', () => {
  it('returns role and status as display objects', () => {
    const result = toUserResponse(base);
    expect(result.role).toEqual({
      value: 'DEVELOPER',
      label: 'Developer',
      tone: 'default',
    });
    expect(result.status).toEqual({
      value: 'ACTIVE',
      label: 'Active',
      tone: 'success',
    });
  });

  it('makes the root account conspicuous in a list', () => {
    // The reason SYSTEM_ADMIN is toned at all: in a table of people the eye
    // should reach the root account before anything else on the row.
    expect(toUserResponse({ ...base, role: Role.SYSTEM_ADMIN }).role.tone).toBe(
      'danger',
    );
    expect(toUserResponse({ ...base, role: Role.ADMIN }).role.tone).toBe(
      'primary',
    );
  });

  it.each([
    [UserStatus.INVITED, 'warning'],
    [UserStatus.ACTIVE, 'success'],
    [UserStatus.SUSPENDED, 'danger'],
  ])('tones %s as %s', (status, tone) => {
    expect(toUserResponse({ ...base, status }).status.tone).toBe(tone);
  });

  it.each([
    [Weekday.FRIDAY, 'Friday'],
    [Weekday.SATURDAY, 'Saturday'],
  ])('maps weeklyOffDay %s to the label %s', (weeklyOffDay, label) => {
    expect(toUserResponse({ ...base, weeklyOffDay }).weeklyOffDay).toEqual({
      value: weeklyOffDay,
      label,
      tone: 'default',
    });
  });

  it('leaves every other field untouched', () => {
    const result = toUserResponse({ ...base, slackUserId: 'U08ABCDEF' });
    expect(result.id).toBe('u1');
    expect(result.email).toBe('rezina@pixelvega.com');
    expect(result.name).toBe('Rezina Akter');
    expect(result.slackUserId).toBe('U08ABCDEF');
  });

  it('does NOT invent fields that were not selected', () => {
    // The mapper spreads; it must not add keys, or a reduced projection would
    // silently gain the ones it was reduced to avoid.
    const result = toUserResponse(base);
    expect(Object.keys(result).sort()).toEqual(
      ['email', 'id', 'name', 'role', 'status', 'weeklyOffDay'].sort(),
    );
  });
});
