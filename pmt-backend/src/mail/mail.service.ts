import { Injectable, Logger } from '@nestjs/common';

import { parseCorsOrigins } from '@/common/utils/parse-cors-origins.util';
import { createTransport, Transporter } from 'nodemailer';
import { inviteEmailTemplate } from '@/mail/templates/invite.template';
import { passwordResetEmailTemplate } from '@/mail/templates/password-reset.template';

/**
 * Where an email should send someone: the dashboard, never this API.
 *
 * Falls back to the first trusted origin so a deployment that sets
 * CORS_ORIGINS correctly gets working links without a second variable.
 */
function appUrl(): string {
  return (
    process.env.APP_URL ?? parseCorsOrigins(process.env.CORS_ORIGINS)[0] ?? ''
  );
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter = createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  async sendInviteEmail(
    to: string,
    name: string,
    setPasswordUrl: string,
    expiresInMinutes: number,
  ) {
    const { subject, html, text } = inviteEmailTemplate({
      name,
      setPasswordUrl,
      expiresInMinutes,
    });
    await this.send(to, subject, html, text);
  }

  /**
   * The password reset link, sent by better-auth's `sendResetPassword` hook.
   *
   * `expiresInMinutes` is passed through to the copy so the email cannot
   * promise a window the config does not give.
   */
  async sendPasswordResetEmail(
    to: string,
    resetUrl: string,
    expiresInMinutes: number,
  ) {
    const { subject, html, text } = passwordResetEmailTemplate({
      resetUrl,
      expiresInMinutes,
    });
    await this.send(to, subject, html, text);
  }

  /**
   * Send both parts.
   *
   * `text` is not optional. A message with no plain alternative scores worse
   * with spam filters and is unreadable in a client that blocks HTML, and
   * every template produces one from the same inputs anyway.
   */
  private async send(to: string, subject: string, html: string, text: string) {
    await this.transporter.sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject,
      html,
      text,
    });
    this.logger.log(`Sent "${subject}" to ${to}`);
  }
}
