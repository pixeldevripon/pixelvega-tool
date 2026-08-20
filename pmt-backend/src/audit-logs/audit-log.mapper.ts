import { AuditLog, User } from '@prisma/client';

import { AuditLogResponseDto } from './dto/audit-log.dto';

/**
 * The audit log row a reader sees.
 *
 * The module had no mapper and returned `paginate()`'s result untouched, which
 * is how `action` reached a screen as the raw `user.password_changed`.
 */

export type AuditLogActor = Pick<User, 'id' | 'name' | 'email'>;

export type AuditLogWithActor = AuditLog & {
  user?: AuditLogActor | null;
};

/**
 * The action as a person would read it: `user.password_changed` becomes
 * "User password changed".
 *
 * ── Why derived rather than a lookup table ──
 *
 * The action vocabulary is deliberately open. `AuditLogResponseDto` says so:
 * "The vocabulary grows as features land; it is not a database enum." A
 * `Record<action, label>` map would therefore need an entry added in this file
 * every time any feature emits a new action, and the day somebody forgets, the
 * audit log renders a blank cell for the very event that mattered enough to
 * audit. Deriving it cannot go stale.
 *
 * ── Why on the server at all ──
 *
 * It is four string operations, and that is exactly the point: two clients would
 * each implement the same four and eventually disagree about one of them, which
 * is the test D4 sets. `action` still ships exact and unchanged beside it, and
 * that is the field a filter or a comparison uses. Nothing may branch on the
 * label.
 */
export function toActionLabel(action: string): string {
  const words = action.replace(/[._]+/g, ' ').trim();
  if (!words) return action;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function toAuditLogResponse(
  entry: AuditLogWithActor,
): AuditLogResponseDto {
  return {
    id: entry.id,
    action: entry.action,
    actionLabel: toActionLabel(entry.action),
    targetType: entry.targetType,
    targetId: entry.targetId,
    metadata: entry.metadata,
    userId: entry.userId,
    // Field by field, never a spread. A spread puts whatever the query happened
    // to select into the response, which is how an undeclared field ships.
    user: entry.user
      ? {
          id: entry.user.id,
          name: entry.user.name,
          email: entry.user.email,
        }
      : null,
    createdAt: entry.createdAt,
  };
}
