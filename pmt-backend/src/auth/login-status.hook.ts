import { Injectable } from '@nestjs/common';
import { AfterHook, BeforeHook, Hook } from '@thallesp/nestjs-better-auth';
import type { AuthHookContext } from '@thallesp/nestjs-better-auth';
import { APIError } from 'better-auth';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../modules/audit-log/audit-log.service';

@Injectable()
@Hook()
export class LoginStatusHook {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  @BeforeHook('/sign-in/email')
  async blockSuspendedLogin(ctx: AuthHookContext) {
    const email = (ctx.body as { email?: string } | undefined)?.email;
    if (!email) return;

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user?.status === 'SUSPENDED') {
      throw new APIError('FORBIDDEN', {
        message:
          'Your account has been suspended. Please contact an administrator.',
        code: 'ACCOUNT_SUSPENDED',
      });
    }
  }

  @AfterHook('/sign-in/email')
  async activateOnFirstLogin(ctx: AuthHookContext) {
    const user = ctx.context.newSession?.user;
    if (user && user.status === 'INVITED') {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE' },
      });
      await this.auditLog.log({
        userId: user.id,
        action: 'user.activated',
        targetType: 'User',
        targetId: user.id,
      });
    }
  }
}
