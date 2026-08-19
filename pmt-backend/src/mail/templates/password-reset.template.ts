import { emailShell, RenderedEmail } from '@/mail/templates/email-shell';

export interface PasswordResetEmailInput {
  resetUrl: string;
  /** How long the link is valid, so the copy cannot promise a different window. */
  expiresInMinutes: number;
}

/**
 * The password reset link.
 *
 * The expiry is a parameter rather than written into the copy, because copy and
 * config drifting apart is the classic failure here: the email promises an
 * hour, the token dies in fifteen minutes, and nobody can explain why.
 */
export function passwordResetEmailTemplate({
  resetUrl,
  expiresInMinutes,
}: PasswordResetEmailInput): RenderedEmail & { subject: string } {
  return {
    subject: 'Reset your PixelVega password',
    ...emailShell({
      title: 'Reset your password',
      paragraphs: [
        'Someone asked to reset the password for this PixelVega account. Choose a new one using the button below.',
      ],
      ctaLabel: 'Choose a new password',
      ctaUrl: resetUrl,
      footnote:
        `This link works for ${expiresInMinutes} minutes and can be used once. ` +
        'If you did not ask for this you can ignore this email: your password will not change.',
    }),
  };
}
