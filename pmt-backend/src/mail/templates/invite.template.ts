import { emailShell, RenderedEmail } from '@/mail/templates/email-shell';
import { escapeHtml } from '@/mail/templates/email-text.util';

export interface InviteEmailInput {
  name: string;
  tempPassword: string;
  /** Where to sign in. The dashboard, not the API. */
  signInUrl: string;
}

/**
 * The invite, sent when an admin creates an account.
 *
 * The temporary password is the payload, so it is the centrepiece rather than
 * a `<strong>` buried in a sentence. The name is escaped: it is user data, and
 * this template previously interpolated it raw.
 */
export function inviteEmailTemplate({
  name,
  tempPassword,
  signInUrl,
}: InviteEmailInput): RenderedEmail & { subject: string } {
  return {
    subject: 'Your PixelVega account is ready',
    ...emailShell({
      title: 'Your PixelVega account is ready',
      greeting: `Hi ${escapeHtml(name)},`,
      paragraphs: [
        'An administrator has created a PixelVega account for you. Sign in with the temporary password below.',
      ],
      code: tempPassword,
      codeNote:
        'You will be asked to choose your own password on first sign in.',
      ctaLabel: 'Sign in to PixelVega',
      ctaUrl: signInUrl,
      footnote:
        'If you were not expecting this, you can ignore this email and the account will stay unused.',
    }),
  };
}
