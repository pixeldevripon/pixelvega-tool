/**
 * A MailService usable OUTSIDE Nest's DI container.
 *
 * `auth.instance.ts` is evaluated at module load, long before the Nest app
 * exists, so it cannot inject anything. better-auth's `sendResetPassword` hook
 * runs from there and still has to send an email, so a plain instance is the
 * only way to reach a mail transport from there.
 *
 * Anything inside a Nest module should inject `MailService` instead. Two
 * instances is fine: `MailService` holds only a nodemailer transport, which is
 * a connection pool, not shared state.
 */
import { MailService } from './mail.service';

export const mailService = new MailService();
