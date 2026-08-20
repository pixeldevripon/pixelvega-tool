import {
  AvailabilityStatus,
  EmployeeWorkStatus,
  Gender,
  Role,
  UserStatus,
} from '@prisma/client';

import { toCountryOption } from '@/common/constants/countries';
import {
  AVAILABILITY_STATUS_DISPLAY,
  CONNECTED_ACCOUNT_DISPLAY,
  EMPLOYEE_WORK_STATUS_DISPLAY,
  GENDER_DISPLAY,
  ROLE_DISPLAY,
  USER_STATUS_DISPLAY,
  toEnumDisplay,
} from '@/common/utils/enum-display.util';

type ProfileShape = {
  role: Role;
  status: UserStatus;
  gender: Gender | null;
  country: string | null;
  slackUserId?: string | null;
  employeeProfile?: {
    phone: string | null;
    currentStatus: EmployeeWorkStatus;
    availabilityStatus: AvailabilityStatus;
  } | null;
  clientProfile?: {
    phone: string | null;
  } | null;
};

/** An `Account` row as the profile query selects it. */
export interface AccountRow {
  providerId: string;
  accountId: string;
  createdAt: Date;
}

/**
 * Whether the caller may delete their own account.
 *
 * Exported and named, rather than inlined below, because
 * `ProfilesService.deleteOwnAccount` asserts with THIS function. A capability
 * flag and its enforcement re-deriving the same rule separately is the most
 * repeated defect in this codebase: five flags shipped wider than the assertion
 * behind them, each offering a button that then answered 403.
 *
 * There must always be a root account, and there is exactly one: the SYSTEM_ADMIN
 * bootstrapped on first boot. Nothing in the API creates a second, so letting it
 * delete itself would leave the deployment with no way back in.
 */
export function mayDeleteOwnAccount(role: Role): boolean {
  return role !== Role.SYSTEM_ADMIN;
}

/**
 * The connections list, assembled from two unrelated places.
 *
 * better-auth owns the `Account` rows; the Slack link is a member id cached on
 * the User row by `SlackUserResolverService` and is not an `Account` at all. A
 * client should not have to know that, so both arrive in one list.
 *
 * `canDisconnect` is false for the credential row and that is not a policy
 * choice to revisit: it is the only way into the account, and a settings screen
 * that can lock someone out of their own account is a defect rather than a
 * feature. Every account here has exactly one, created by the invite.
 */
function toConnectedAccounts(
  accounts: AccountRow[],
  user: { slackUserId?: string | null; createdAt?: Date },
) {
  const connections = accounts.map((account) => {
    const isCredential = account.providerId === 'credential';
    return {
      provider: toEnumDisplay(
        CONNECTED_ACCOUNT_DISPLAY,
        isCredential ? 'CREDENTIAL' : account.providerId.toUpperCase(),
      ),
      // `accountId` is the provider's identifier for the person, which for the
      // credential provider is the user id rather than anything worth showing.
      // Never a token: `Account` also holds access and refresh tokens, and none
      // of them are selected on the way here.
      detail: isCredential ? null : account.accountId,
      connectedAt: account.createdAt,
      canDisconnect: !isCredential,
    };
  });

  if (user.slackUserId) {
    connections.push({
      provider: toEnumDisplay(CONNECTED_ACCOUNT_DISPLAY, 'SLACK'),
      detail: user.slackUserId,
      // There is no row recording when the id was cached, and inventing a date
      // would be worse than reusing the account's: this list is ordered by when
      // things were connected, and the Slack link has always been implied by the
      // account existing.
      connectedAt: user.createdAt ?? new Date(0),
      canDisconnect: true,
    });
  }

  return connections;
}

/**
 * The part of a profile ANY permitted viewer may read.
 *
 * Two jobs, both of them D4 work the browser would otherwise do:
 *
 * 1. Every enum becomes `{ value, label, tone }`, and the country becomes
 *    `{ value, label }` (no tone: there is nothing about a country to grade).
 * 2. `phone` is HOISTED out of whichever profile table applies, so a form binds
 *    to one field instead of branching on the role to find it. Both nested
 *    profiles keep theirs, because `GET /profiles/:userId` has other readers.
 *
 * `slackUserId` is stripped rather than spread through. It is on the row because
 * `toOwnProfileResponse` builds the connections list from it, and a staffing
 * lookup has no business receiving another person's Slack member id.
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

  const { slackUserId: _slackUserId, ...rest } = user;

  return {
    ...rest,
    role: toEnumDisplay(ROLE_DISPLAY, user.role),
    status: toEnumDisplay(USER_STATUS_DISPLAY, user.status),
    gender: user.gender ? toEnumDisplay(GENDER_DISPLAY, user.gender) : null,
    country: toCountryOption(user.country),
    phone: user.employeeProfile?.phone ?? user.clientProfile?.phone ?? null,
    employeeProfile,
  };
}

/**
 * The caller's OWN profile: everything above, plus what only the owner may see.
 *
 * Split from `toProfileResponse` rather than gated by a flag inside it, because
 * the difference is not cosmetic and getting it wrong is a leak.
 * `GET /profiles/:userId` is a staffing lookup available to anyone holding
 * `VIEW_USER_PROFILE`, and returning this half from it would hand them another
 * person's connected accounts (their Slack member id, when their credential was
 * created).
 *
 * `capabilities` would be actively misleading there too: every flag answers
 * "may the SUBJECT do this to their own account", so `canDeleteAccount: true` on
 * a colleague's profile reads as "I may delete them", which is the opposite of
 * what the API would allow.
 */
export function toOwnProfileResponse<T extends ProfileShape>(
  user: T,
  accounts: AccountRow[] = [],
) {
  return {
    ...toProfileResponse(user),
    capabilities: {
      // Every role holds EDIT_OWN_PROFILE: these routes only ever touch the
      // caller's own record, so there is nobody to scope them against. Stated as
      // a field anyway, because a client that hardcodes `true` cannot be told
      // otherwise on the day that changes.
      canEditProfile: true,
      // See ProfileCapabilitiesDto: an email is the account identity, and
      // changing it safely needs a verified two-inbox flow this API does not
      // expose.
      canChangeEmail: false,
      // `UsersService.update` refuses a self role change outright. The flag
      // exists so the screen disables the control and says why, rather than
      // hiding a field the design asks for.
      canChangeRole: false,
      canDeleteAccount: mayDeleteOwnAccount(user.role),
    },
    connectedAccounts: toConnectedAccounts(accounts, user),
  };
}
