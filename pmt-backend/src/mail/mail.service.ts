import { Injectable, Logger } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';
import { inviteEmailTemplate } from '@/mail/templates/invite.template';
import { passwordResetEmailTemplate } from '@/mail/templates/password-reset.template';

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

  async sendInviteEmail(to: string, name: string, tempPassword: string) {
    const { subject, html } = inviteEmailTemplate({ name, tempPassword });
    await this.send(to, subject, html);
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
    const { subject, html } = passwordResetEmailTemplate({
      resetUrl,
      expiresInMinutes,
    });
    await this.send(to, subject, html);
  }

  private async send(to: string, subject: string, html: string) {
    await this.transporter.sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject,
      html,
    });
    this.logger.log(`Sent "${subject}" to ${to}`);
  }
}
