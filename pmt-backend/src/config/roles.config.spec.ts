/**
 * Unit tests for the role to permission map (directive D2).
 *
 * The superset property is ASSERTED here rather than trusted. The old `Roles`
 * decorator wrapper enforced it implicitly by unioning SYSTEM_ADMIN and ADMIN
 * into every list; now that the union is written out by hand in the map, only
 * a test keeps it true.
 */

import { Permission, Role } from '@prisma/client';
import { ROLE_HIERARCHY, ROLE_PERMISSIONS } from './roles.config';

const ALL_ROLES = Object.values(Role);
const ALL_PERMISSIONS = Object.values(Permission);

describe('ROLE_PERMISSIONS', () => {
  describe('completeness', () => {
    it('declares an entry for every Role', () => {
      for (const role of ALL_ROLES) {
        expect(ROLE_PERMISSIONS[role]).toBeDefined();
      }
      expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual(
        [...ALL_ROLES].sort(),
      );
    });

    it('only ever names real Permission values', () => {
      for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
        for (const permission of permissions) {
          expect(ALL_PERMISSIONS).toContain(permission);
        }
      }
    });

    it('never lists the same permission twice for one role', () => {
      for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
        expect(new Set(permissions).size).toBe(permissions.length);
      }
    });

    it('grants every declared Permission to at least one role', () => {
      // A permission nothing grants is dead weight: either a route is
      // unreachable, or the value was added and never wired up.
      const granted = new Set(Object.values(ROLE_PERMISSIONS).flat());
      const orphans = ALL_PERMISSIONS.filter((p) => !granted.has(p));
      expect(orphans).toEqual([]);
    });
  });

  describe('the hierarchy holds: each role is a strict superset of the one below', () => {
    it.each(ROLE_HIERARCHY)('%s holds everything %s holds', (higher, lower) => {
      const higherSet = new Set(ROLE_PERMISSIONS[higher]);
      const missing = ROLE_PERMISSIONS[lower].filter((p) => !higherSet.has(p));
      expect(missing).toEqual([]);
    });

    it('PROJECT_MANAGER is deliberately NOT a superset of DEVELOPER', () => {
      // They are siblings, not a ladder. A PM runs projects but does not track
      // project time or author a daily work report. Modelling PM as "developer
      // plus management" would silently hand PMs time tracking, which the
      // routes withhold on purpose.
      const pm = new Set(ROLE_PERMISSIONS[Role.PROJECT_MANAGER]);
      expect(pm.has(Permission.TRACK_PROJECT_TIME)).toBe(false);
      expect(pm.has(Permission.SUBMIT_WORK_REPORT)).toBe(false);
      expect(ROLE_PERMISSIONS[Role.DEVELOPER]).toContain(
        Permission.TRACK_PROJECT_TIME,
      );
      expect(ROLE_PERMISSIONS[Role.DEVELOPER]).toContain(
        Permission.SUBMIT_WORK_REPORT,
      );
    });

    it('DEVELOPER is likewise not a superset of PROJECT_MANAGER', () => {
      const dev = new Set(ROLE_PERMISSIONS[Role.DEVELOPER]);
      expect(dev.has(Permission.CREATE_PROJECT)).toBe(false);
      expect(dev.has(Permission.MANAGE_PROJECT_MEMBERS)).toBe(false);
    });

    it('SYSTEM_ADMIN and ADMIN hold the same capability set', () => {
      // What SYSTEM_ADMIN has over ADMIN is not a capability but an IDENTITY
      // rule (only it may invite or edit an ADMIN, and it can never be
      // deleted). Those live as explicit checks in UsersService, because a
      // permission cannot express "about whom".
      expect([...ROLE_PERMISSIONS[Role.SYSTEM_ADMIN]].sort()).toEqual(
        [...ROLE_PERMISSIONS[Role.ADMIN]].sort(),
      );
    });

    it('DEVELOPER and DESIGNER hold the same set', () => {
      expect([...ROLE_PERMISSIONS[Role.DEVELOPER]].sort()).toEqual(
        [...ROLE_PERMISSIONS[Role.DESIGNER]].sort(),
      );
    });
  });

  describe('a CLIENT is kept out of everything internal', () => {
    const clientPermissions = ROLE_PERMISSIONS[Role.CLIENT];

    it.each([
      Permission.VIEW_ALL_PROJECTS,
      Permission.VIEW_PROJECT_MEMBERS,
      Permission.VIEW_PROJECT_ACTIVITY,
      Permission.VIEW_INTERNAL_REVIEWS,
      Permission.VIEW_BLOCKERS,
      Permission.VIEW_WORK_REPORTS,
      Permission.VIEW_TIME_ENTRIES,
      Permission.VIEW_ADDITIONAL_REQUIREMENTS,
      Permission.VIEW_PROJECT_REPORTS,
      Permission.VIEW_USERS,
      Permission.VIEW_AUDIT_LOG,
      Permission.CHANGE_PROJECT_STATUS,
      Permission.TRACK_PROJECT_TIME,
    ])('a CLIENT does NOT hold %s', (permission) => {
      expect(clientPermissions).not.toContain(permission);
    });

    it('a CLIENT can still see and act on their own project', () => {
      expect(clientPermissions).toEqual(
        expect.arrayContaining([
          Permission.VIEW_OWN_PROJECTS,
          Permission.SUBMIT_CLIENT_FEEDBACK,
          Permission.VIEW_CLIENT_FEEDBACK,
        ]),
      );
    });
  });

  describe('delivery staff are kept out of management capabilities', () => {
    it.each([
      Permission.CREATE_PROJECT,
      Permission.EDIT_PROJECT,
      Permission.MANAGE_PROJECT_MEMBERS,
      Permission.ARCHIVE_PROJECT,
      Permission.REVIEW_WORK_REPORT,
      Permission.SUBMIT_INTERNAL_REVIEW,
      Permission.INVITE_USER,
      Permission.VIEW_AUDIT_LOG,
    ])('a DEVELOPER does NOT hold %s', (permission) => {
      expect(ROLE_PERMISSIONS[Role.DEVELOPER]).not.toContain(permission);
    });
  });

  describe('admin only capabilities', () => {
    it.each([
      Permission.ARCHIVE_PROJECT,
      Permission.INVITE_USER,
      Permission.UPDATE_USER,
      Permission.DELETE_USER,
      Permission.VIEW_AUDIT_LOG,
      Permission.MANAGE_LEAVE_TYPES,
      Permission.MANAGE_HOLIDAYS,
      Permission.MANAGE_AI_TEMPLATES,
      Permission.REVIEW_LEAVE_REQUEST,
      Permission.VIEW_LEAVE_SUMMARY,
    ])('%s is held by ADMIN and SYSTEM_ADMIN only', (permission) => {
      const holders = ALL_ROLES.filter((role) =>
        ROLE_PERMISSIONS[role].includes(permission),
      );
      expect(holders.sort()).toEqual([Role.ADMIN, Role.SYSTEM_ADMIN].sort());
    });
  });
});
