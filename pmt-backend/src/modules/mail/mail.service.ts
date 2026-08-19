import { Injectable, Logger } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';
import { inviteEmailTemplate } from './templates/invite.template';
import { resetCodeEmailTemplate } from './templates/reset-code.template';

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

  async sendResetCodeEmail(to: string, code: string) {
    const { subject, html } = resetCodeEmailTemplate({ code });
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
