import { inviteEmailTemplate } from '../templates/invite.template';
import { passwordResetEmailTemplate } from '../templates/password-reset.template';

describe('inviteEmailTemplate', () => {
  const input = {
    name: 'Rezina Akter',
    tempPassword: 'Temp-Pass-123',
    signInUrl: 'https://app.pixelvega.com',
  };

  it('makes the temporary password the centrepiece, not a buried sentence', () => {
    const { html, text } = inviteEmailTemplate(input);
    expect(html).toContain('Temp-Pass-123');
    expect(text).toContain('Temp-Pass-123');
  });

  it('escapes the name, which is user data', () => {
    // The previous template interpolated this raw, so a display name could
    // carry markup into every recipient's inbox.
    const { html } = inviteEmailTemplate({
      ...input,
      name: '<script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('sends the recipient to the dashboard, not to the API', () => {
    const { html } = inviteEmailTemplate(input);
    expect(html).toContain('https://app.pixelvega.com');
  });

  it('says the password is temporary, so nobody keeps it', () => {
    expect(inviteEmailTemplate(input).text).toContain(
      'choose your own password',
    );
  });
});

describe('passwordResetEmailTemplate', () => {
  const input = {
    resetUrl: 'https://app.pixelvega.com/reset-password?token=abc',
    expiresInMinutes: 60,
  };

  it('states the expiry the config actually gives it', () => {
    // Copy and config drifting apart is the classic failure: the email
    // promises an hour, the token dies in fifteen minutes.
    expect(passwordResetEmailTemplate(input).text).toContain('60 minutes');
    expect(
      passwordResetEmailTemplate({ ...input, expiresInMinutes: 15 }).text,
    ).toContain('15 minutes');
  });

  it('tells a recipient who did not ask that they can ignore it', () => {
    const { text } = passwordResetEmailTemplate(input);
    expect(text).toContain('your password will not change');
  });

  it('carries the link in both parts', () => {
    const { html, text } = passwordResetEmailTemplate(input);
    expect(html).toContain(input.resetUrl);
    expect(text).toContain(input.resetUrl);
  });

  it('has no greeting, because a reset is not addressed by name', () => {
    // The reset flow answers identically for a known and unknown address, so
    // naming the person would leak that the account exists.
    expect(passwordResetEmailTemplate(input).text).not.toContain('Hi ');
  });
});
