import { AvailabilityStatus, EmployeeWorkStatus, Role } from '@prisma/client';

import {
  AVAILABILITY_STATUS_DISPLAY,
  EMPLOYEE_WORK_STATUS_DISPLAY,
  ROLE_DISPLAY,
  toEnumDisplay,
} from '@/common/utils/enum-display.util';

type ProfileShape = {
  role: Role;
  employeeProfile?: {
    currentStatus: EmployeeWorkStatus;
    availabilityStatus: AvailabilityStatus;
  } | null;
};

/**
 * The three enums a profile screen renders.
 *
 * `employeeProfile` is absent for a CLIENT, who has a `clientProfile` instead,
 * so the nested map is conditional rather than assumed.
 */
export function toProfileResponse<T extends ProfileShape>(user: T) {
  // Written as an explicit branch rather than a conditional spread. Spreading
  // `...(x && { employeeProfile })` over a `T` that already declares
  // `employeeProfile: null` produces an intersection TypeScript reduces to
  // `never`, so the caller loses every field on the result.
  const employeeProfile = user.employeeProfile
    ? {
        ...user.employeeProfile,
        currentStatus: toEnumDisplay(
          EMPLOYEE_WORK_STATUS_DISPLAY,
          user.employeeProfile.currentStatus,
        ),
        availabilityStatus: toEnumDisplay(
          AVAILABILITY_STATUS_DISPLAY,
          user.employeeProfile.availabilityStatus,
        ),
      }
    : user.employeeProfile;

  return {
    ...user,
    role: toEnumDisplay(ROLE_DISPLAY, user.role),
    employeeProfile,
  };
}
