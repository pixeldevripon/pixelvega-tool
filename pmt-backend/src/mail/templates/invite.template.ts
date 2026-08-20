import { emailShell, RenderedEmail } from '@/mail/templates/email-shell';
import { escapeHtml } from '@/mail/templates/email-text.util';

export interface InviteEmailInput {
  name: string;
  /** The one time set-password link. Points at the dashboard, not the API. */
  setPasswordUrl: string;
  /** How long the link lives, so the copy cannot promise more than it has. */
  expiresInMinutes: number;
}

/**
 * The invite, sent when an administrator creates an account.
 *
 * The payload is a LINK, not a password. An earlier version put a temporary
 * password in the body, which meant a working credential sat in an inbox in
 * plain text with no expiry: a forward, a shared inbox, or a mailbox breach
 * months later was account access. This link expires and is single use, and
 * the account has no usable password until it is followed.
 */
export function inviteEmailTemplate({
  name,
  setPasswordUrl,
  expiresInMinutes,
}: InviteEmailInput): RenderedEmail & { subject: string } {
  return {
    subject: 'Your PixelVega account is ready',
    ...emailShell({
      title: 'Your PixelVega account is ready',
      greeting: `Hi ${escapeHtml(name)},`,
      paragraphs: [
        'An administrator has created a PixelVega account for you. Choose a password to finish setting it up.',
        // In `paragraphs` rather than `codeNote`, which the shell only renders
        // alongside a `code` block. This email has no code.
        `This link works once and expires in ${expiresInMinutes} minutes. Ask an administrator to send a new invitation if it has already expired.`,
      ],
      ctaLabel: 'Set your password',
      ctaUrl: setPasswordUrl,
      footnote:
        'If you were not expecting this, you can ignore this email. The account cannot be signed into until a password is set.',
    }),
  };
}
