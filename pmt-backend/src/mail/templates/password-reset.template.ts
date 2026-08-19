interface PasswordResetEmailInput {
  resetUrl: string;
  /** How long the link stays valid, in minutes, so the copy matches the config. */
  expiresInMinutes: number;
}

/**
 * The reset email.
 *
 * The expiry is passed in rather than written into the copy, because the copy
 * and the config drifting apart is the classic bug here: the email promises an
 * hour, the token dies in fifteen minutes, and the user has no idea why.
 */
export function passwordResetEmailTemplate({
  resetUrl,
  expiresInMinutes,
}: PasswordResetEmailInput) {
  return {
    subject: 'Reset your PixelVega password',
    html: `
      <div style="font-family: system-ui, sans-serif; line-height: 1.6; color: #111;">
        <h2 style="margin: 0 0 16px;">Reset your password</h2>
        <p>Someone asked to reset the password for this PixelVega account.</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}"
             style="background: #111; color: #fff; padding: 12px 20px; border-radius: 6px; text-decoration: none; display: inline-block;">
            Choose a new password
          </a>
        </p>
        <p style="color: #555; font-size: 14px;">
          This link works for ${expiresInMinutes} minutes. If you did not ask for
          this, you can ignore this email: your password will not change.
        </p>
        <p style="color: #888; font-size: 12px; word-break: break-all;">
          If the button does not work, paste this into your browser:<br />${resetUrl}
        </p>
      </div>
    `,
  };
}
