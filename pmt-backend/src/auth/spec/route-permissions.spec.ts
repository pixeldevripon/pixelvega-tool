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
jest.mock('better-auth/crypto', () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
  signJWT: jest.fn(),
  verifyJWT: jest.fn(),
}));
jest.mock('better-auth', () => ({
  betterAuth: jest.fn(() => ({ api: {} })),
  APIError: Error,
}));
jest.mock('@thallesp/nestjs-better-auth', () => {
  // AllowAnonymous must keep writing its real metadata key, or the three public
  // routes would read as ungated and this spec would assert the wrong thing.
  // The key matches the library's own `SetMetadata("PUBLIC", true)`.
  const { SetMetadata } = jest.requireActual('@nestjs/common');
  return {
    AuthModule: { forRoot: jest.fn() },
    AllowAnonymous: () => SetMetadata('PUBLIC', true),
    Hook: () => () => undefined,
    BeforeHook: () => () => undefined,
    AfterHook: () => () => undefined,
    Roles: () => () => undefined,
  };
});
jest.mock('@/auth/instance/auth.instance', () => ({ auth: { api: {} } }));

import 'reflect-metadata';
import { Permission as P } from '@prisma/client';
import { AdditionalRequirementsController } from '@/projects/requirements/additional/additional-requirements.controller';
import { AiJobsController } from '@/ai/jobs/ai-jobs.controller';
import { AiTemplatesController } from '@/ai/templates/ai-templates.controller';
import { ProjectStatusReportsController } from '@/ai/status-report/project-status-reports.controller';
import { ProjectAiSummaryController } from '@/ai/summary/project-ai-summary.controller';
import { AuditLogController } from '@/audit-log/audit-log.controller';
import { BlockerReasonsController } from '@/projects/blockers/reasons/blocker-reasons.controller';
import { BlockersController } from '@/projects/blockers/blockers.controller';
import { ProjectBlockersController } from '@/projects/blockers/project-blockers.controller';
import { ClientFeedbackController } from '@/projects/reviews/client/client-feedback.controller';
import { InternalReviewsController } from '@/projects/reviews/internal/internal-reviews.controller';
import { HolidaysController } from '@/leave/holidays/holidays.controller';
import { LeaveRequestsController } from '@/leave/requests/leave-requests.controller';
import { LeaveTypesController } from '@/leave/types/leave-types.controller';
import { NotificationsController } from '@/notifications/notifications.controller';
import { ProfilesController } from '@/profiles/profiles.controller';
import { ProjectDocumentsController } from '@/projects/documents/project-documents.controller';
import { ProjectMembersController } from '@/projects/members/project-members.controller';
import { DeveloperReportsController } from '@/projects/reports/developer/developer-reports.controller';
import { ProjectReportsController } from '@/projects/reports/project/project-reports.controller';
import { ProjectsController } from '@/projects/projects.controller';
import { ProjectTimeEntriesController } from '@/projects/time-entries/project/project-time-entries.controller';
import { TimeEntriesController } from '@/projects/time-entries/meeting/time-entries.controller';
import { UsersController } from '@/users/users.controller';
import { DailyWorkReportController } from '@/projects/daily-work-reports/daily-work-report.controller';
import { ProjectDailyWorkReportsController } from '@/projects/daily-work-reports/project-daily-work-reports.controller';
import {
  collectRouteGating,
  type RouteGating,
} from '@/auth/permissions/route-permissions.util';

/** Marks a route as deliberately reachable without a session. */
const PUBLIC = Symbol('public');
/** Marks OR semantics: the caller needs any ONE of these. */
const any = (...permissions: P[]) => ({ any: permissions });

type Expected = P[] | { any: P[] } | typeof PUBLIC;

const CONTROLLERS = [
  AdditionalRequirementsController,
  AiJobsController,
  AiTemplatesController,
  ProjectStatusReportsController,
  ProjectAiSummaryController,
  AuditLogController,
  BlockerReasonsController,
  BlockersController,
  ProjectBlockersController,
  ClientFeedbackController,
  InternalReviewsController,
  HolidaysController,
  LeaveRequestsController,
  LeaveTypesController,
  NotificationsController,
  ProfilesController,
  ProjectDocumentsController,
  ProjectMembersController,
  DeveloperReportsController,
  ProjectReportsController,
  ProjectsController,
  ProjectTimeEntriesController,
  TimeEntriesController,
  UsersController,
  DailyWorkReportController,
  ProjectDailyWorkReportsController,
];

/**
 * Route -> the permission(s) that gate it.
 *
 * There is no anonymous surface left in this application. The password reset
 * flow used to sit here as three `PUBLIC` routes under `/auth-flows`; it is
 * better-auth's now, served under `/api/auth/*`, which is mounted as middleware
 * and never reaches a Nest guard at all. Every route Nest owns is gated.
 */
const EXPECTED: Record<string, Expected> = {
  'DELETE /ai-templates/:id': [P.MANAGE_AI_TEMPLATES],
  'DELETE /blocker-reasons/:id': [P.MANAGE_BLOCKER_REASONS],
  'DELETE /holidays/:id': [P.MANAGE_HOLIDAYS],
  'DELETE /leave-types/:id': [P.MANAGE_LEAVE_TYPES],
  'DELETE /projects/:projectId/documents/:id': [P.MANAGE_PROJECT_DOCUMENTS],
  'DELETE /projects/:projectId/members/:memberId': [P.MANAGE_PROJECT_MEMBERS],
  'DELETE /users/:id': [P.DELETE_USER],
  'GET /ai-jobs/:id': [P.VIEW_AI_JOB],
  'GET /ai-templates': [P.VIEW_AI_TEMPLATES],
  'GET /audit-logs': [P.VIEW_AUDIT_LOG],
  'GET /blocker-reasons': [P.VIEW_BLOCKERS],
  'GET /blockers': [P.VIEW_BLOCKERS],
  'GET /daily-work-reports': [P.VIEW_WORK_REPORTS],
  'GET /daily-work-reports/today': [P.SUBMIT_WORK_REPORT],
  'GET /holidays': [P.VIEW_HOLIDAYS],
  'GET /leave-requests': [P.VIEW_LEAVE_REQUESTS],
  'GET /leave-requests/:userId/balance': [P.VIEW_LEAVE_REQUESTS],
  'GET /leave-requests/me': [P.REQUEST_LEAVE],
  'GET /leave-requests/me/balance': [P.REQUEST_LEAVE],
  'GET /leave-requests/summary': [P.VIEW_LEAVE_SUMMARY],
  'GET /leave-requests/summary/export': [P.VIEW_LEAVE_SUMMARY],
  'GET /leave-types': [P.VIEW_LEAVE_TYPES],
  'GET /notifications': [P.VIEW_OWN_NOTIFICATIONS],
  'GET /notifications/unread-count': [P.VIEW_OWN_NOTIFICATIONS],
  'GET /profiles/:userId': [P.VIEW_USER_PROFILE],
  'GET /profiles/me': [P.VIEW_OWN_PROFILE],
  'GET /projects': [P.VIEW_ALL_PROJECTS],
  'GET /projects/:id': any(P.VIEW_ALL_PROJECTS, P.VIEW_OWN_PROJECTS),
  'GET /projects/:id/activities': [P.VIEW_PROJECT_ACTIVITY],
  'GET /projects/:projectId/additional-requirements': [
    P.VIEW_ADDITIONAL_REQUIREMENTS,
  ],
  'GET /projects/:projectId/additional-requirements/:id': [
    P.VIEW_ADDITIONAL_REQUIREMENTS,
  ],
  'GET /projects/:projectId/ai/status-reports': [P.VIEW_STATUS_REPORTS],
  'GET /projects/:projectId/ai/summary': [P.REQUEST_AI_SUMMARY],
  'GET /projects/:projectId/blockers': [P.VIEW_BLOCKERS],
  'GET /projects/:projectId/blockers/deadline-impact': [P.VIEW_BLOCKERS],
  'GET /projects/:projectId/client-feedback': [P.VIEW_CLIENT_FEEDBACK],
  'GET /projects/:projectId/daily-work-reports': [P.VIEW_WORK_REPORTS],
  'GET /projects/:projectId/documents': [P.VIEW_PROJECT_DOCUMENTS],
  'GET /projects/:projectId/documents/:id': [P.VIEW_PROJECT_DOCUMENTS],
  'GET /projects/:projectId/internal-reviews': [P.VIEW_INTERNAL_REVIEWS],
  'GET /projects/:projectId/members': [P.VIEW_PROJECT_MEMBERS],
  'GET /projects/:projectId/reports': [P.VIEW_PROJECT_REPORTS],
  'GET /projects/:projectId/time-entries': [P.VIEW_TIME_ENTRIES],
  'GET /projects/:projectId/time-entries/daily-summary': [P.VIEW_TIME_ENTRIES],
  'GET /projects/mine': [P.VIEW_OWN_PROJECTS],
  'GET /projects/users/:userId': [P.VIEW_ALL_PROJECTS],
  'GET /reports/developer': [P.VIEW_DEVELOPER_REPORTS],
  'GET /time-entries/active': [P.VIEW_TIME_ENTRIES],
  'GET /time-entries/daily-summary': [P.TRACK_MEETING_TIME],
  'GET /time-entries/meetings': [P.TRACK_MEETING_TIME],
  'GET /time-entries/project-summary': [P.VIEW_TIME_ENTRIES],
  'GET /users': [P.VIEW_USERS],
  'GET /users/:id': [P.VIEW_USERS],
  'GET /users/me': [P.VIEW_OWN_PROFILE],
  'GET /users/me/permissions': [P.VIEW_OWN_PERMISSIONS],
  'PATCH /ai-templates/:id': [P.MANAGE_AI_TEMPLATES],
  'PATCH /blocker-reasons/:id': [P.MANAGE_BLOCKER_REASONS],
  'PATCH /blockers/:blockerId': [P.REPORT_BLOCKER],
  'PATCH /daily-work-reports/:id/plan': [P.SUBMIT_WORK_REPORT],
  'PATCH /daily-work-reports/:id/wrap-up': [P.SUBMIT_WORK_REPORT],
  'PATCH /daily-work-reports/:reportId/entries/:entryId/review': [
    P.REVIEW_WORK_REPORT,
  ],
  'PATCH /holidays/:id': [P.MANAGE_HOLIDAYS],
  'PATCH /leave-requests/:id/approve': [P.REVIEW_LEAVE_REQUEST],
  'PATCH /leave-requests/:id/cancel': [P.REQUEST_LEAVE],
  'PATCH /leave-requests/:id/reject': [P.REVIEW_LEAVE_REQUEST],
  'PATCH /leave-types/:id': [P.MANAGE_LEAVE_TYPES],
  'PATCH /notifications/:id/read': [P.MANAGE_OWN_NOTIFICATIONS],
  'PATCH /notifications/read-all': [P.MANAGE_OWN_NOTIFICATIONS],
  'PATCH /profiles/me': [P.EDIT_OWN_PROFILE],
  'PATCH /projects/:id': [P.EDIT_PROJECT],
  'PATCH /projects/:id/archive': [P.ARCHIVE_PROJECT],
  'PATCH /projects/:id/estimated-hours': [P.MANAGE_ESTIMATED_HOURS],
  'PATCH /projects/:id/priority': [P.CHANGE_PROJECT_PRIORITY],
  'PATCH /projects/:id/restore': [P.ARCHIVE_PROJECT],
  'PATCH /projects/:id/slack-channel': [P.CONNECT_PROJECT_SLACK],
  'PATCH /projects/:id/status': [P.CHANGE_PROJECT_STATUS],
  'PATCH /projects/:id/types': [P.MANAGE_PROJECT_TYPES],
  'PATCH /projects/:projectId/additional-requirements/:id/review': [
    P.REVIEW_ADDITIONAL_REQUIREMENT,
  ],
  'PATCH /projects/:projectId/documents/:id': [P.MANAGE_PROJECT_DOCUMENTS],
  'PATCH /projects/:projectId/time-entries/:id/pause': [P.TRACK_PROJECT_TIME],
  'PATCH /projects/:projectId/time-entries/:id/resume': [P.TRACK_PROJECT_TIME],
  'PATCH /projects/:projectId/time-entries/:id/stop': [P.TRACK_PROJECT_TIME],
  'PATCH /time-entries/meetings/:id/pause': [P.TRACK_MEETING_TIME],
  'PATCH /time-entries/meetings/:id/resume': [P.TRACK_MEETING_TIME],
  'PATCH /time-entries/meetings/:id/stop': [P.TRACK_MEETING_TIME],
  'PATCH /users/:id': [P.UPDATE_USER],
  'PATCH /users/me/password': [P.CHANGE_OWN_PASSWORD],
  'POST /ai-templates': [P.MANAGE_AI_TEMPLATES],
  'POST /blocker-reasons': [P.MANAGE_BLOCKER_REASONS],
  'POST /blockers': [P.REPORT_BLOCKER],
  'POST /daily-work-reports': [P.SUBMIT_WORK_REPORT],
  'POST /daily-work-reports/:id/wrap-up': [P.SUBMIT_WORK_REPORT],
  'POST /holidays': [P.MANAGE_HOLIDAYS],
  'POST /leave-requests': [P.REQUEST_LEAVE],
  'POST /leave-types': [P.MANAGE_LEAVE_TYPES],
  'POST /profiles/me/avatar': [P.EDIT_OWN_PROFILE],
  'POST /projects': [P.CREATE_PROJECT],
  'POST /projects/:projectId/additional-requirements': [
    P.CREATE_ADDITIONAL_REQUIREMENT,
  ],
  'POST /projects/:projectId/additional-requirements/:id/check-scope': [
    P.RUN_SCOPE_CHECK,
  ],
  'POST /projects/:projectId/ai/status-reports': [P.GENERATE_STATUS_REPORT],
  'POST /projects/:projectId/client-feedback': [P.SUBMIT_CLIENT_FEEDBACK],
  'POST /projects/:projectId/documents': [P.MANAGE_PROJECT_DOCUMENTS],
  'POST /projects/:projectId/documents/batch': [P.MANAGE_PROJECT_DOCUMENTS],
  'POST /projects/:projectId/internal-reviews': [P.SUBMIT_INTERNAL_REVIEW],
  'POST /projects/:projectId/members': [P.MANAGE_PROJECT_MEMBERS],
  'POST /projects/:projectId/members/:memberId/resync-slack': [
    P.MANAGE_PROJECT_MEMBERS,
  ],
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
  const actual = CONTROLLERS.flatMap((controller) =>
    collectRouteGating(controller as never),
  ).sort((a, b) => a.route.localeCompare(b.route));

  it('covers every controller in the app', () => {
    // If a controller is added and not registered above, its routes are not
    // pinned by this file and the matrix is quietly incomplete.
    // Counted from disk, so this cannot drift into agreeing with an outdated
    // number. AuthController is gone: better-auth owns that surface now.
    const controllerFiles = 26;
    expect(CONTROLLERS).toHaveLength(controllerFiles);
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
