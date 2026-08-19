import { AvailabilityStatus, EmployeeWorkStatus, Role } from '@prisma/client';

import { toProfileResponse } from '../profile.mapper';

describe('toProfileResponse', () => {
  it('returns the role as a display object', () => {
    expect(toProfileResponse({ role: Role.DESIGNER }).role).toEqual({
      value: 'DESIGNER',
      label: 'Designer',
      tone: 'default',
    });
  });

  it('maps the employee profile statuses when there is one', () => {
    const result = toProfileResponse({
      role: Role.DEVELOPER,
      employeeProfile: {
        currentStatus: EmployeeWorkStatus.ON_LEAVE,
        availabilityStatus: AvailabilityStatus.UNAVAILABLE,
      },
    });
    expect(result.employeeProfile?.currentStatus).toEqual({
      value: 'ON_LEAVE',
      label: 'On leave',
      tone: 'warning',
    });
    expect(result.employeeProfile?.availabilityStatus).toEqual({
      value: 'UNAVAILABLE',
      label: 'Unavailable',
      tone: 'danger',
    });
  });

  it('leaves a CLIENT alone, who has no employee profile', () => {
    // A client has a clientProfile instead, so the nested map is conditional
    // rather than assumed. Assuming it would put an `employeeProfile: {}` on
    // every client.
    const result = toProfileResponse({
      role: Role.CLIENT,
      employeeProfile: null,
    });
    expect(result.role.value).toBe('CLIENT');
    expect(result.employeeProfile).toBeNull();
  });

  it('reports undefined when the field was never selected', () => {
    // Distinct from null, which means "selected, and this user has none".
    const result = toProfileResponse({ role: Role.CLIENT });
    expect(result.employeeProfile).toBeUndefined();
  });

  it('keeps the other employee profile fields', () => {
    const result = toProfileResponse({
      role: Role.DEVELOPER,
      employeeProfile: {
        currentStatus: EmployeeWorkStatus.WORKING,
        availabilityStatus: AvailabilityStatus.AVAILABLE,
        designation: 'Senior Developer',
      } as never,
    });
    expect(
      (result.employeeProfile as unknown as { designation: string })
        .designation,
    ).toBe('Senior Developer');
  });
});
