import { Injectable, UnauthorizedException } from '@nestjs/common';
import { hashPassword, signJWT, verifyJWT } from 'better-auth/crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { generateResetCode, hashResetCode } from '../../common/utils/code.util';

const CODE_TTL_MINUTES = 10;
const RESET_TOKEN_TTL_SECONDS = 10 * 60;

interface ResetTokenPayload {
  userId: string;
  purpose: 'password-reset';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly auditLog: AuditLogService,
  ) {}

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      const code = generateResetCode();
      await this.prisma.passwordResetCode.create({
        data: {
          userId: user.id,
          codeHash: hashResetCode(code),
          expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
        },
      });
      await this.mail.sendResetCodeEmail(email, code);
    }

    return {
      message:
        'If an account exists for this email, a reset code has been sent.',
    };
  }

  async verifyResetCode(email: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const record = user
      ? await this.prisma.passwordResetCode.findFirst({
          where: {
            userId: user.id,
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: 'desc' },
        })
      : null;

    if (!user || !record || record.codeHash !== hashResetCode(code)) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    await this.prisma.passwordResetCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    const resetToken = await signJWT(
      { userId: user.id, purpose: 'password-reset' },
      process.env.BETTER_AUTH_SECRET as string,
      RESET_TOKEN_TTL_SECONDS,
    );

    return { resetToken };
  }

  async resetPassword(resetToken: string, newPassword: string) {
    const payload = await verifyJWT<ResetTokenPayload>(
      resetToken,
      process.env.BETTER_AUTH_SECRET as string,
    );

    if (!payload || payload.purpose !== 'password-reset') {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const hashed = await hashPassword(newPassword);

    await this.prisma.account.updateMany({
      where: { userId: payload.userId, providerId: 'credential' },
      data: { password: hashed },
    });

    await this.prisma.user.update({
      where: { id: payload.userId },
      data: { mustResetPassword: false },
    });

    await this.auditLog.log({
      userId: payload.userId,
      action: 'user.password_reset',
      targetType: 'User',
      targetId: payload.userId,
    });

    return { message: 'Password has been reset.' };
  }
}
