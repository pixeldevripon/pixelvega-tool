import { Role, User, UserStatus, Weekday } from '@prisma/client';

import {
  ROLE_DISPLAY,
  USER_STATUS_DISPLAY,
  WEEKDAY_DISPLAY,
  toEnumDisplay,
} from '@/common/utils/enum-display.util';

/** Exactly what `USER_SELECT` in the service produces. */
type SelectedUser = {
  role: Role;
  status: UserStatus;
  weeklyOffDay: Weekday;
} & Partial<User>;

/**
 * Role, status and weeklyOffDay as display objects.
 *
 * The role badge is the reason SYSTEM_ADMIN tones as `danger`: in a user list
 * the eye should catch the root account before anything else on the row.
 */
export function toUserResponse<T extends SelectedUser>(user: T) {
  return {
    ...user,
    role: toEnumDisplay(ROLE_DISPLAY, user.role),
    status: toEnumDisplay(USER_STATUS_DISPLAY, user.status),
    weeklyOffDay: toEnumDisplay(WEEKDAY_DISPLAY, user.weeklyOffDay),
  };
}
