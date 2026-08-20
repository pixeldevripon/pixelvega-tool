import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { MailService } from '@/mail/mail.service';
import { ProfilesService } from '@/profiles/profiles.service';
import { AuditLogService } from '@/audit-log/audit-log.service';
import { auth } from '@/auth/instance/auth.instance';
import { generateUnusedPassword } from '@/common/utils/password.util';

// Creates the first SYSTEM_ADMIN user on boot if the User table is
// completely empty, using SEED_ADMIN_EMAIL/SEED_ADMIN_NAME. Runs on every
// startup, so a fresh environment never needs a manual bootstrap step. It
// does nothing once any user exists. Missing env vars are logged and
// skipped rather than thrown, since this must never block app startup.
@Injectable()
export class SystemAdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SystemAdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly profiles: ProfilesService,
    private readonly auditLog: AuditLogService,
  ) {}

  async onApplicationBootstrap() {
    const email = process.env.SEED_ADMIN_EMAIL;
    const name = process.env.SEED_ADMIN_NAME;
    if (!email || !name) {
      this.logger.warn(
        'SEED_ADMIN_EMAIL/SEED_ADMIN_NAME not set — skipping system admin bootstrap.',
      );
      return;
    }

    const userCount = await this.prisma.user.count();
    if (userCount > 0) {
      return;
    }

    await auth.api.signUpEmail({
      body: { email, password: generateUnusedPassword(), name },
    });

    const user = await this.prisma.user.update({
      where: { email },
      data: {
        role: Role.SYSTEM_ADMIN,
        status: 'INVITED',
        mustResetPassword: true,
      },
    });

    await this.profiles.createForRole(user.id, Role.SYSTEM_ADMIN);

    await this.auditLog.log({
      action: 'user.invited',
      targetType: 'User',
      targetId: user.id,
      metadata: { email, role: Role.SYSTEM_ADMIN, bootstrap: true },
    });

    // Sends the set-password link. See UsersService.invite: no `headers`, so
    // better-auth's hook sends the invite copy rather than a reset.
    await auth.api.requestPasswordReset({ body: { email } });

    this.logger.log(
      `Bootstrap SYSTEM_ADMIN created and invite email sent to ${email}.`,
    );
  }
}
