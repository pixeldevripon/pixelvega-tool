/**
 * A MailService usable OUTSIDE Nest's DI container.
 *
 * `auth.instance.ts` is evaluated at module load, long before the Nest app
 * exists, so it cannot inject anything. better-auth's `sendResetPassword` hook
 * runs from there and still has to send an email. This is the same solution the
 * reference uses (`island-tour-development/backend/src/mail/mail.singleton.ts`).
 *
 * Anything inside a Nest module should inject `MailService` instead. Two
 * instances is fine: `MailService` holds only a nodemailer transport, which is
 * a connection pool, not shared state.
 */
import { MailService } from './mail.service';

export const mailService = new MailService();
