import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { AuditLogService } from '@/audit-logs/audit-log.service';
import { PrismaService } from '@/prisma/prisma.service';
import { toSessionResponse } from '@/profiles/sessions/session.mapper';

/**
 * Never `include:` and never the whole row. `Session.token` is a bearer
 * credential: selecting it here is fine because the mapper compares against it
 * and drops it, but it must never be spread onto a response, and a `select`
 * makes that a deliberate line rather than an omission.
 */
const SESSION_SELECT = {
  id: true,
  token: true,
  ipAddress: true,
  userAgent: true,
  createdAt: true,
  expiresAt: true,
};

@Injectable()
export class ProfileSessionsService {
  private readonly logger = new Logger(ProfileSessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Where the caller is currently signed in.
   *
   * Expired rows are filtered out rather than shown greyed. better-auth does not
   * delete a session when it expires, so the table holds months of dead rows,
   * and a security screen listing sessions that cannot be used is a screen
   * nobody can read a real intrusion off.
   *
   * Newest first, because the row someone is looking for after a suspicious
   * email is the one that just appeared.
   */
  async findMine(userId: string, currentToken: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      select: SESSION_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return sessions.map((session) => toSessionResponse(session, currentToken));
  }

  /**
   * Sign one device out.
   *
   * The `userId` in the where clause is the whole authorization story: without
   * it, a caller could pass any session id and sign out any user in the system.
   * It is a compound condition rather than a fetch-then-check, so there is no
   * window between the two and no way to answer a 404 that confirms the id
   * belongs to somebody else.
   */
  async revoke(userId: string, sessionId: string, currentToken: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
      select: { id: true, token: true },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Reads the same predicate `capabilities.canRevoke` is built from. Signing
    // yourself out from a device list is the sign-out button's job: doing it
    // here would log someone out of the page they are on, which reads as a bug
    // rather than as the action they asked for.
    if (session.token === currentToken) {
      throw new BadRequestException(
        'This is the session you are using. Sign out instead.',
      );
    }

    await this.prisma.session.delete({ where: { id: session.id } });
    await this.auditLog.log({
      userId,
      action: 'session.revoked',
      targetType: 'Session',
      targetId: session.id,
    });
    this.logger.log(`User ${userId} revoked session ${session.id}`);

    return this.findMine(userId, currentToken);
  }

  /**
   * Sign out everywhere else, keeping the session making the request.
   *
   * Deliberately not "sign out everywhere including here": that is the sign-out
   * button, and merging the two would mean the button that says "keep me signed
   * in on this device" sometimes does not.
   */
  async revokeOthers(userId: string, currentToken: string) {
    const { count } = await this.prisma.session.deleteMany({
      where: { userId, token: { not: currentToken } },
    });

    if (count > 0) {
      await this.auditLog.log({
        userId,
        action: 'session.revoked_others',
        targetType: 'User',
        targetId: userId,
        metadata: { revoked: count },
      });
      this.logger.log(`User ${userId} revoked ${count} other sessions`);
    }

    return {
      revoked: count,
      // Written by the server so both halves of the sentence agree about the
      // number and about the plural. A client assembling this would be deriving
      // a message from a count, which is exactly the work D4 moves here.
      message:
        count === 0
          ? 'There were no other devices to sign out.'
          : `Signed out of ${count} other ${count === 1 ? 'device' : 'devices'}.`,
    };
  }
}
