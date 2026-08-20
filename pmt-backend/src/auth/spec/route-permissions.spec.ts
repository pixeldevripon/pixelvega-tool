/**
 * The permission matrix: every route in the app, and exactly which permission
 * gates it.
 *
 * This is the safety net under directive D2. Phase 4 rewrote the gating on all
 * 109 routes, and a single wrong permission there either locks a role out of
 * work they need or hands them access they should not have, neither of which is
 * visible from reading a controller. Pinning the whole matrix means any change
 * to a route's gating shows up as a deliberate edit to this file in the diff.
 *
 * It reads the metadata the decorators actually wrote, via Reflect, not the
 * source text. Two earlier text-parsing attempts got it wrong: one attributed
 * the previous route's decorator when scanning backwards, the other could not
 * see a decorator Prettier had wrapped across lines. Metadata has neither
 * failure mode and is what PermissionsGuard itself reads at runtime.
 *
 * When this fails, do not just update the expectation. Decide first whether the
 * new gating is correct.
 */

// Importing a controller pulls in its constructor parameter types at runtime,
// because emitDecoratorMetadata needs them, and that chain reaches better-auth,
// which ships ESM that Jest's CJS transform cannot parse. None of it is used
// here: this spec only reads decorator metadata off the classes.
jest.mock('better-auth/node', () => ({ fromNodeHeaders: jest.fn() }));
jest.mock('better-auth', () => ({
  betterAuth: jest.fn(() => ({ api: {} })),
  APIError: Error,
}));
jest.mock('@/auth/instance/auth.instance', () => ({ auth: { api: {} } }));

import 'reflect-metadata';
import { Permission as P } from '@prisma/client';
import { ALL_CONTROLLERS } from '@/app.controllers';
import {
  collectRouteGating,
  type RouteGating,
} from '@/auth/permissions/route-permissions.util';

/** Marks a route as deliberately reachable without a session. */
const PUBLIC = Symbol('public');
/** Marks OR semantics: the caller needs any ONE of these. */
const any = (...permissions: P[]) => ({ any: permissions });

type Expected = P[] | { any: P[] } | typeof PUBLIC;

/**
 * Route -> the permission(s) that gate it.
 *
 * There is no anonymous surface left in this application. The password reset
 * flow used to sit here as three `PUBLIC` routes under `/auth-flows`; it is
 * better-auth's now, served under `/api/auth/*`, which is mounted as middleware
 * and never reaches a Nest guard at all. Every route Nest owns is gated.
 */
const EXPECTED: Record<string, Expected> = {
  'DELETE /ai/templates/:templateId': [P.MANAGE_AI_TEMPLATES],
  'DELETE /blockers/reasons/:reasonId': [P.MANAGE_BLOCKER_REASONS],
  'DELETE /leave/holidays/:holidayId': [P.MANAGE_HOLIDAYS],
  'DELETE /leave/types/:leaveTypeId': [P.MANAGE_LEAVE_TYPES],
  'DELETE /projects/:projectId/documents/:documentId': [
    P.MANAGE_PROJECT_DOCUMENTS,
  ],
  'DELETE /projects/:projectId/members/:memberId': [P.MANAGE_PROJECT_MEMBERS],
  'DELETE /users/:userId': [P.DELETE_USER],
  'GET /ai/jobs/:jobId': [P.VIEW_AI_JOB],
  'GET /ai/templates': [P.VIEW_AI_TEMPLATES],
  'GET /audit-logs': [P.VIEW_AUDIT_LOG],
  'GET /blockers': [P.VIEW_BLOCKERS],
  'GET /dashboard': [P.VIEW_DASHBOARD],
  'GET /blockers/reasons': [P.VIEW_BLOCKERS],
  'GET /daily-work-reports': [P.VIEW_WORK_REPORTS],
  'GET /daily-work-reports/today': [P.SUBMIT_WORK_REPORT],
  'GET /leave/balances/:userId': [P.VIEW_LEAVE_REQUESTS],
  'GET /leave/balances/me': [P.REQUEST_LEAVE],
  'GET /leave/holidays': [P.VIEW_HOLIDAYS],
  'GET /leave/requests': [P.VIEW_LEAVE_REQUESTS],
  'GET /leave/requests/me': [P.REQUEST_LEAVE],
  'GET /leave/requests/summary': [P.VIEW_LEAVE_SUMMARY],
  'GET /leave/requests/summary/export': [P.VIEW_LEAVE_SUMMARY],
  'GET /leave/types': [P.VIEW_LEAVE_TYPES],
  'GET /notifications': [P.VIEW_OWN_NOTIFICATIONS],
  'GET /notifications/unread-count': [P.VIEW_OWN_NOTIFICATIONS],
  'GET /profiles/:userId': [P.VIEW_USER_PROFILE],
  'GET /profiles/me': [P.VIEW_OWN_PROFILE],
  'GET /projects': [P.VIEW_ALL_PROJECTS],
  'GET /projects/:projectId': any(P.VIEW_ALL_PROJECTS, P.VIEW_OWN_PROJECTS),
  'GET /projects/:projectId/activities': [P.VIEW_PROJECT_ACTIVITY],
  'GET /projects/:projectId/ai/status-reports': [P.VIEW_STATUS_REPORTS],
  'GET /projects/:projectId/ai/summary': [P.REQUEST_AI_SUMMARY],
  'GET /projects/:projectId/blockers': [P.VIEW_BLOCKERS],
  'GET /projects/:projectId/blockers/deadline-impact': [P.VIEW_BLOCKERS],
  'GET /projects/:projectId/daily-work-reports': [P.VIEW_WORK_REPORTS],
  'GET /projects/:projectId/documents': [P.VIEW_PROJECT_DOCUMENTS],
  'GET /projects/:projectId/documents/:documentId': [P.VIEW_PROJECT_DOCUMENTS],
  'GET /projects/:projectId/members': [P.VIEW_PROJECT_MEMBERS],
  'GET /projects/:projectId/reports': [P.VIEW_PROJECT_REPORTS],
  'GET /projects/:projectId/requirements/additional': [
    P.VIEW_ADDITIONAL_REQUIREMENTS,
  ],
  'GET /projects/:projectId/requirements/additional/:requirementId': [
    P.VIEW_ADDITIONAL_REQUIREMENTS,
  ],
  'GET /projects/:projectId/reviews/client': [P.VIEW_CLIENT_FEEDBACK],
  'GET /projects/:projectId/reviews/internal': [P.VIEW_INTERNAL_REVIEWS],
  'GET /projects/:projectId/time-entries': [P.VIEW_TIME_ENTRIES],
  'GET /projects/:projectId/time-entries/daily-summary': [P.VIEW_TIME_ENTRIES],
  'GET /projects/mine': [P.VIEW_OWN_PROJECTS],
  'GET /projects/users/:userId': [P.VIEW_ALL_PROJECTS],
  'GET /reports/developers': [P.VIEW_DEVELOPER_REPORTS],
  'GET /time-entries/active': [P.VIEW_TIME_ENTRIES],
  'GET /time-entries/daily-summary': [P.TRACK_MEETING_TIME],
  'GET /time-entries/meetings': [P.TRACK_MEETING_TIME],
  'GET /time-entries/project-summary': [P.VIEW_TIME_ENTRIES],
  'GET /users': [P.VIEW_USERS],
  'GET /users/:userId': [P.VIEW_USERS],
  'GET /users/me': [P.VIEW_OWN_PROFILE],
  'GET /users/me/permissions': [P.VIEW_OWN_PERMISSIONS],
  'PATCH /ai/templates/:templateId': [P.MANAGE_AI_TEMPLATES],
  'PATCH /blockers/reasons/:reasonId': [P.MANAGE_BLOCKER_REASONS],
  'PATCH /daily-work-reports/:reportId/entries/:entryId/review': [
    P.REVIEW_WORK_REPORT,
  ],
  'PATCH /daily-work-reports/:reportId/plan': [P.SUBMIT_WORK_REPORT],
  'PATCH /daily-work-reports/:reportId/wrap-up': [P.SUBMIT_WORK_REPORT],
  'PATCH /leave/holidays/:holidayId': [P.MANAGE_HOLIDAYS],
  'PATCH /leave/requests/:leaveRequestId/approve': [P.REVIEW_LEAVE_REQUEST],
  'PATCH /leave/requests/:leaveRequestId/cancel': [P.REQUEST_LEAVE],
  'PATCH /leave/requests/:leaveRequestId/reject': [P.REVIEW_LEAVE_REQUEST],
  'PATCH /leave/types/:leaveTypeId': [P.MANAGE_LEAVE_TYPES],
  'PATCH /notifications/:notificationId/read': [P.MANAGE_OWN_NOTIFICATIONS],
  'PATCH /notifications/read-all': [P.MANAGE_OWN_NOTIFICATIONS],
  'PATCH /profiles/me': [P.EDIT_OWN_PROFILE],
  'PATCH /projects/:projectId': [P.EDIT_PROJECT],
  'PATCH /projects/:projectId/archive': [P.ARCHIVE_PROJECT],
  'PATCH /projects/:projectId/blockers/:blockerId': [P.REPORT_BLOCKER],
  'PATCH /projects/:projectId/documents/:documentId': [
    P.MANAGE_PROJECT_DOCUMENTS,
  ],
  'PATCH /projects/:projectId/estimated-hours': [P.MANAGE_ESTIMATED_HOURS],
  'PATCH /projects/:projectId/priority': [P.CHANGE_PROJECT_PRIORITY],
  'PATCH /projects/:projectId/requirements/additional/:requirementId/review': [
    P.REVIEW_ADDITIONAL_REQUIREMENT,
  ],
  'PATCH /projects/:projectId/restore': [P.ARCHIVE_PROJECT],
  'PATCH /projects/:projectId/slack-channel': [P.CONNECT_PROJECT_SLACK],
  'PATCH /projects/:projectId/status': [P.CHANGE_PROJECT_STATUS],
  'PATCH /projects/:projectId/time-entries/:timeEntryId/pause': [
    P.TRACK_PROJECT_TIME,
  ],
  'PATCH /projects/:projectId/time-entries/:timeEntryId/resume': [
    P.TRACK_PROJECT_TIME,
  ],
  'PATCH /projects/:projectId/time-entries/:timeEntryId/stop': [
    P.TRACK_PROJECT_TIME,
  ],
  'PATCH /projects/:projectId/types': [P.MANAGE_PROJECT_TYPES],
  'PATCH /time-entries/meetings/:timeEntryId/pause': [P.TRACK_MEETING_TIME],
  'PATCH /time-entries/meetings/:timeEntryId/resume': [P.TRACK_MEETING_TIME],
  'PATCH /time-entries/meetings/:timeEntryId/stop': [P.TRACK_MEETING_TIME],
  'PATCH /users/:userId': [P.UPDATE_USER],
  'POST /ai/templates': [P.MANAGE_AI_TEMPLATES],
  'POST /blockers/reasons': [P.MANAGE_BLOCKER_REASONS],
  'POST /daily-work-reports': [P.SUBMIT_WORK_REPORT],
  'POST /daily-work-reports/:reportId/wrap-up': [P.SUBMIT_WORK_REPORT],
  'POST /leave/holidays': [P.MANAGE_HOLIDAYS],
  'POST /leave/requests': [P.REQUEST_LEAVE],
  'POST /leave/types': [P.MANAGE_LEAVE_TYPES],
  'POST /profiles/me/avatar': [P.EDIT_OWN_PROFILE],
  'POST /projects': [P.CREATE_PROJECT],
  'POST /projects/:projectId/ai/status-reports': [P.GENERATE_STATUS_REPORT],
  'POST /projects/:projectId/blockers': [P.REPORT_BLOCKER],
  'POST /projects/:projectId/documents': [P.MANAGE_PROJECT_DOCUMENTS],
  'POST /projects/:projectId/documents/batch': [P.MANAGE_PROJECT_DOCUMENTS],
  'POST /projects/:projectId/members': [P.MANAGE_PROJECT_MEMBERS],
  'POST /projects/:projectId/members/:memberId/resync-slack': [
    P.MANAGE_PROJECT_MEMBERS,
  ],
  'POST /projects/:projectId/requirements/additional': [
    P.CREATE_ADDITIONAL_REQUIREMENT,
  ],
  'POST /projects/:projectId/requirements/additional/:requirementId/check-scope':
    [P.RUN_SCOPE_CHECK],
  'POST /projects/:projectId/reviews/client': [P.SUBMIT_CLIENT_FEEDBACK],
  'POST /projects/:projectId/reviews/internal': [P.SUBMIT_INTERNAL_REVIEW],
  'POST /projects/:projectId/time-entries/start': [P.TRACK_PROJECT_TIME],
  'POST /time-entries/meetings/start': [P.TRACK_MEETING_TIME],
  'POST /users/invite': [P.INVITE_USER],
};

function describeExpected(expected: Expected): string {
  if (expected === PUBLIC) return 'PUBLIC';
  if (Array.isArray(expected)) return `ALL(${expected.join(', ')})`;
  return `ANY(${expected.any.join(', ')})`;
}

function describeActual(route: RouteGating): string {
  if (route.gate === 'PUBLIC') return 'PUBLIC';
  if (route.gate === 'UNGATED') return 'UNGATED';
  return `${route.gate}(${route.permissions.join(', ')})`;
}

describe('route permission matrix', () => {
  const actual = ALL_CONTROLLERS.flatMap((controller) =>
    collectRouteGating(controller as never),
  ).sort((a, b) => a.route.localeCompare(b.route));

  it('covers every controller in the app', () => {
    // If a controller is added and not registered above, its routes are not
    // pinned by this file and the matrix is quietly incomplete.
    // Counted from disk, so this cannot drift into agreeing with an outdated
    // number. AuthController is gone: better-auth owns that surface now.
    const controllerFiles = 29;
    expect(ALL_CONTROLLERS).toHaveLength(controllerFiles);
  });

  it('finds the expected number of routes', () => {
    expect(actual).toHaveLength(109);
  });

  it('has an expectation for every route, and a route for every expectation', () => {
    const found = actual.map((route) => route.route).sort();
    const declared = Object.keys(EXPECTED).sort();
    expect(found).toEqual(declared);
  });

  it('gates every route, with nothing left ungated', () => {
    const ungated = actual.filter((route) => route.gate === 'UNGATED');
    expect(ungated.map((route) => route.route)).toEqual([]);
  });

  it('has NO anonymous surface at all', () => {
    // Every unauthenticated flow is better-auth's now. A `PUBLIC` route
    // appearing here again means someone hand rolled an anonymous endpoint,
    // which is the thing this whole migration removed.
    const publicRoutes = actual
      .filter((route) => route.gate === 'PUBLIC')
      .map((route) => route.route)
      .sort();
    expect(publicRoutes).toEqual([]);
  });

  describe('each route carries the permission it should', () => {
    for (const route of Object.keys(EXPECTED).sort()) {
      it(route, () => {
        const found = actual.find((candidate) => candidate.route === route);
        expect(found).toBeDefined();
        expect(describeActual(found!)).toBe(describeExpected(EXPECTED[route]));
      });
    }
  });
});
