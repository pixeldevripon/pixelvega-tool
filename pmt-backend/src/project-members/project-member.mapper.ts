import { ProjectMember, ProjectRole, Role, User } from '@prisma/client';

import {
  PROJECT_ROLE_DISPLAY,
  ROLE_DISPLAY,
  toEnumDisplay,
} from '@/common/utils/enum-display.util';
import { ProjectMemberResponseDto } from './dto/project-member.dto';

/** Exactly what `MEMBER_INCLUDE` in the service produces. */
export type ProjectMemberWithUser = ProjectMember & {
  user: Pick<User, 'id' | 'name' | 'email' | 'role'>;
};

/**
 * What the caller is allowed to do, as far as the response can promise.
 *
 * Passed in rather than computed here so this file stays pure and free of a
 * database: the service already knows whether the caller manages the project,
 * because it had to ask in order to authorize the request at all.
 */
export type ProjectMemberContext = {
  /** Does the caller manage this project? From `ProjectScopeService`. */
  managesProject: boolean;
  /** Does the project have a Slack channel to invite anyone into? */
  hasSlackChannel: boolean;
};

/**
 * A member row as the API returns it.
 *
 * Three things happen here that used to happen in the browser: the roles become
 * `{ value, label, tone }`, `leftAt` gains a plain `isActive` boolean beside it,
 * and the row states what the caller may do to it.
 */
export function toProjectMemberResponse(
  member: ProjectMemberWithUser,
  context: ProjectMemberContext,
): ProjectMemberResponseDto {
  const isActive = member.leftAt === null;

  return {
    id: member.id,
    projectId: member.projectId,
    userId: member.userId,
    role: toEnumDisplay(PROJECT_ROLE_DISPLAY, member.role),
    joinedAt: member.joinedAt,
    leftAt: member.leftAt,
    isActive,
    user: {
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
      role: toEnumDisplay(ROLE_DISPLAY, member.user.role),
    },
    capabilities: {
      // A member who has already left cannot be removed again. The service
      // enforces this with a 409, and saying so here is what stops the UI from
      // offering the button that produces it.
      canRemove: context.managesProject && isActive,
      // Resyncing invites someone to the project's Slack channel, so it is
      // meaningless without a channel to invite them to.
      canResyncSlack:
        context.managesProject && isActive && context.hasSlackChannel,
    },
  };
}
