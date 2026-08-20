import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ProfilesService } from '@/profiles/profiles.service';
import { AuditLogService } from '@/audit-logs/audit-log.service';
import { auth } from '@/auth/instance/auth.instance';

// Creates the first SYSTEM_ADMIN user on boot if the User table is
// completely empty, from ADMIN_EMAIL/ADMIN_NAME/ADMIN_PASSWORD. Runs on every
// startup, so a fresh environment never needs a manual bootstrap step. It
// does nothing once any user exists. Missing env vars are logged and
// skipped rather than thrown, since this must never block app startup.
//
// The password comes from the environment rather than being generated and
// emailed as a set-password link. This account is the root of the permission
// model, and nobody can invite anyone until it can sign in: making that depend
// on SMTP being configured meant a fresh deployment with no mail provider had
// no way in at all. `env.validate.ts` holds the password to better-auth's eight
// character floor. Every OTHER account is still invited and sets its own, and
// `UsersService.invite` must never start emailing one.
@Injectable()
export class SystemAdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SystemAdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfilesService,
    private readonly auditLog: AuditLogService,
  ) {}

  async onApplicationBootstrap() {
    const email = process.env.ADMIN_EMAIL;
    const name = process.env.ADMIN_NAME;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !name || !password) {
      this.logger.warn(
        'ADMIN_EMAIL/ADMIN_NAME/ADMIN_PASSWORD not set, skipping system admin bootstrap.',
      );
      return;
    }

    const userCount = await this.prisma.user.count();
    if (userCount > 0) {
      return;
    }

    await auth.api.signUpEmail({ body: { email, password, name } });

    // signUpEmail cannot set these: `input: false` on every additional field is
    // what stops a caller choosing their own role, so the role has to be applied
    // here, on the row better-auth just wrote.
    const user = await this.prisma.user.update({
      where: { email },
      data: {
        role: Role.SYSTEM_ADMIN,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        mustResetPassword: false,
      },
    });

    await this.profiles.createForRole(user.id, Role.SYSTEM_ADMIN);

    await this.auditLog.log({
      action: 'user.created',
      targetType: 'User',
      targetId: user.id,
      metadata: { email, role: Role.SYSTEM_ADMIN, bootstrap: true },
    });

    this.logger.log(
      `Bootstrap SYSTEM_ADMIN created for ${email}. It signs in with ADMIN_PASSWORD.`,
    );
  }
}
