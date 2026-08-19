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
  return {
    ...user,
    role: toEnumDisplay(ROLE_DISPLAY, user.role),
    ...(user.employeeProfile && {
      employeeProfile: {
        ...user.employeeProfile,
        currentStatus: toEnumDisplay(
          EMPLOYEE_WORK_STATUS_DISPLAY,
          user.employeeProfile.currentStatus,
        ),
        availabilityStatus: toEnumDisplay(
          AVAILABILITY_STATUS_DISPLAY,
          user.employeeProfile.availabilityStatus,
        ),
      },
    }),
  };
}
