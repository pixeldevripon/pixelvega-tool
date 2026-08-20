import { inviteEmailTemplate } from '../templates/invite.template';
import { passwordResetEmailTemplate } from '../templates/password-reset.template';

describe('inviteEmailTemplate', () => {
  const input = {
    name: 'Rezina Akter',
    setPasswordUrl: 'https://app.pixelvega.com/set-password?token=abc123',
    expiresInMinutes: 60,
  };

  it('carries the set-password link', () => {
    const { html, text } = inviteEmailTemplate(input);
    expect(html).toContain(
      'https://app.pixelvega.com/set-password?token=abc123',
    );
    expect(text).toContain(
      'https://app.pixelvega.com/set-password?token=abc123',
    );
  });

  it('contains no password', () => {
    // The whole point of the link. An earlier version put a temporary password
    // in the body, which left a working credential in an inbox in plain text
    // with no expiry.
    const { html, text } = inviteEmailTemplate(input);
    for (const body of [html.toLowerCase(), text.toLowerCase()]) {
      expect(body).not.toContain('temporary password');
      expect(body).not.toContain('sign in with the');
    }
  });

  it('states the expiry, so the copy cannot outlive the token', () => {
    const { html, text } = inviteEmailTemplate(input);
    expect(html).toContain('60 minutes');
    expect(text).toContain('60 minutes');
    // A different TTL must reach the copy, not be hardcoded here.
    expect(
      inviteEmailTemplate({ ...input, expiresInMinutes: 15 }).text,
    ).toContain('15 minutes');
  });

  it('escapes the name, which is user data', () => {
    // The original template interpolated this raw, so a display name could
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
