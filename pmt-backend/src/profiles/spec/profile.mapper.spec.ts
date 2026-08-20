import {
  AvailabilityStatus,
  EmployeeWorkStatus,
  Gender,
  Role,
  UserStatus,
} from '@prisma/client';

import {
  mayDeleteOwnAccount,
  toOwnProfileResponse,
  toProfileResponse,
} from '../profile.mapper';

/** The fields every case needs, so each test only states what it is about. */
const base = {
  role: Role.DEVELOPER,
  status: UserStatus.ACTIVE,
  gender: null,
  country: null,
};

describe('toProfileResponse', () => {
  it('returns the role as a display object', () => {
    expect(toProfileResponse({ ...base, role: Role.DESIGNER }).role).toEqual({
      value: 'DESIGNER',
      label: 'Designer',
      tone: 'default',
    });
  });

  it('returns the account status as a display object', () => {
    expect(
      toProfileResponse({ ...base, status: UserStatus.INVITED }).status,
    ).toEqual({ value: 'INVITED', label: 'Invited', tone: 'warning' });
  });

  it('maps the employee profile statuses when there is one', () => {
    const result = toProfileResponse({
      ...base,
      employeeProfile: {
        phone: null,
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
      ...base,
      role: Role.CLIENT,
      employeeProfile: null,
    });
    expect(result.role.value).toBe('CLIENT');
    expect(result.employeeProfile).toBeNull();
  });

  it('reports undefined when the field was never selected', () => {
    // Distinct from null, which means "selected, and this user has none".
    const result = toProfileResponse({ ...base, role: Role.CLIENT });
    expect(result.employeeProfile).toBeUndefined();
  });

  describe('gender', () => {
    it('is a display object when set', () => {
      expect(
        toProfileResponse({ ...base, gender: Gender.NON_BINARY }).gender,
      ).toEqual({
        value: 'NON_BINARY',
        label: 'Non-binary',
        tone: 'default',
      });
    });

    it('is null rather than an empty display object when unset', () => {
      expect(toProfileResponse(base).gender).toBeNull();
    });
  });

  describe('country', () => {
    it('carries the label so no client ships a country list', () => {
      expect(toProfileResponse({ ...base, country: 'BD' }).country).toEqual({
        value: 'BD',
        label: 'Bangladesh',
      });
    });

    it('is null for a code that is no longer a country', () => {
      // A territory can be dissolved between the day someone saved it and the
      // day they open the form. Rendering a bare "AN" is worse than nothing.
      expect(toProfileResponse({ ...base, country: 'AN' }).country).toBeNull();
    });
  });

  describe('phone', () => {
    it('is hoisted out of the employee profile', () => {
      // So a form binds to one field instead of branching on the role to find
      // out which of two nested objects is holding it.
      const result = toProfileResponse({
        ...base,
        employeeProfile: {
          phone: '+8801700000000',
          currentStatus: EmployeeWorkStatus.WORKING,
          availabilityStatus: AvailabilityStatus.AVAILABLE,
        },
      });
      expect(result.phone).toBe('+8801700000000');
    });

    it('is hoisted out of the client profile for a CLIENT', () => {
      const result = toProfileResponse({
        ...base,
        role: Role.CLIENT,
        employeeProfile: null,
        clientProfile: { phone: '+15551234567' },
      });
      expect(result.phone).toBe('+15551234567');
    });

    it('is null when neither profile holds one', () => {
      expect(toProfileResponse(base).phone).toBeNull();
    });
  });

  describe('capabilities', () => {
    it('never lets anyone change their own email or role', () => {
      // UsersService.update refuses a self role change outright, and there is
      // no verified two-inbox flow for an email. Both flags exist so the screen
      // can disable the control and say why rather than hide the field.
      const { capabilities } = toOwnProfileResponse(base);
      expect(capabilities.canChangeEmail).toBe(false);
      expect(capabilities.canChangeRole).toBe(false);
    });

    it('lets an ordinary role delete their own account', () => {
      expect(toOwnProfileResponse(base).capabilities.canDeleteAccount).toBe(
        true,
      );
    });

    it('refuses the SYSTEM_ADMIN, because there must always be a root account', () => {
      expect(
        toOwnProfileResponse({ ...base, role: Role.SYSTEM_ADMIN }).capabilities
          .canDeleteAccount,
      ).toBe(false);
    });

    it('reads the same predicate the service asserts with', () => {
      // The flag and the enforcement must not derive the rule separately: that
      // is how five buttons in this codebase came to offer actions that then
      // answered 403.
      for (const role of Object.values(Role)) {
        expect(
          toOwnProfileResponse({ ...base, role }).capabilities.canDeleteAccount,
        ).toBe(mayDeleteOwnAccount(role));
      }
    });
  });

  describe('connectedAccounts', () => {
    const credential = {
      providerId: 'credential',
      accountId: 'u1',
      createdAt: new Date('2026-08-01T09:00:00.000Z'),
    };

    it('never offers to disconnect the email and password credential', () => {
      // It is the only way into the account. A settings screen that can lock
      // someone out of their own account is a defect, not a feature.
      const [connection] = toOwnProfileResponse(base, [
        credential,
      ]).connectedAccounts;
      expect(connection.provider).toEqual({
        value: 'CREDENTIAL',
        label: 'Email and password',
        tone: 'primary',
      });
      expect(connection.canDisconnect).toBe(false);
    });

    it('never puts the credential account id on the response', () => {
      // `accountId` for the credential provider is the user id, which is not
      // something to show, and the row it comes from also holds tokens.
      const [connection] = toOwnProfileResponse(base, [
        credential,
      ]).connectedAccounts;
      expect(connection.detail).toBeNull();
    });

    it('adds Slack from the cached member id, which is not an Account row', () => {
      const result = toOwnProfileResponse(
        { ...base, slackUserId: 'U08ABCDEF' },
        [credential],
      );
      expect(result.connectedAccounts).toHaveLength(2);
      const slack = result.connectedAccounts[1];
      expect(slack.provider.value).toBe('SLACK');
      expect(slack.detail).toBe('U08ABCDEF');
      expect(slack.canDisconnect).toBe(true);
    });

    it('omits Slack entirely when no member id is cached', () => {
      const result = toOwnProfileResponse(base, [credential]);
      expect(
        result.connectedAccounts.some((c) => c.provider.value === 'SLACK'),
      ).toBe(false);
    });
  });
});

describe('mayDeleteOwnAccount', () => {
  it('is false only for SYSTEM_ADMIN', () => {
    const refused = Object.values(Role).filter(
      (role) => !mayDeleteOwnAccount(role),
    );
    expect(refused).toEqual([Role.SYSTEM_ADMIN]);
  });
});

describe('the boundary between the two mappers', () => {
  const base = {
    role: Role.DEVELOPER,
    status: UserStatus.ACTIVE,
    gender: null,
    country: null,
    slackUserId: 'U08ABCDEF',
  };

  it("keeps another person's connected accounts off a staffing lookup", () => {
    // GET /profiles/:userId is open to anyone holding VIEW_USER_PROFILE. It must
    // not hand them someone else's Slack member id or when their credential was
    // created.
    const result = toProfileResponse(base);
    expect(result).not.toHaveProperty('connectedAccounts');
    expect(result).not.toHaveProperty('slackUserId');
    expect(JSON.stringify(result)).not.toContain('U08ABCDEF');
  });

  it('keeps capability flags off a staffing lookup', () => {
    // Every flag answers "may the SUBJECT do this to their own account", so
    // canDeleteAccount on a colleague's profile reads as the opposite of what
    // it means.
    expect(toProfileResponse(base)).not.toHaveProperty('capabilities');
  });

  it('still carries everything a staffing lookup legitimately needs', () => {
    const result = toProfileResponse({ ...base, country: 'BD' });
    expect(result.role.value).toBe('DEVELOPER');
    expect(result.country).toEqual({ value: 'BD', label: 'Bangladesh' });
  });

  it('gives the owner both halves', () => {
    const result = toOwnProfileResponse(base);
    expect(result.capabilities.canDeleteAccount).toBe(true);
    expect(result.connectedAccounts).toHaveLength(1);
  });
});
