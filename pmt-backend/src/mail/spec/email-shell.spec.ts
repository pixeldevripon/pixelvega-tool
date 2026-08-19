import { emailShell } from '../templates/email-shell';
import { escapeHtml, toPlainText } from '../templates/email-text.util';

describe('escapeHtml', () => {
  it('escapes the characters that could inject markup', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  it('escapes quotes, not only angle brackets', () => {
    // These values land inside href="..." and style="...", where a bare quote
    // breaks out of the attribute rather than merely rendering oddly.
    expect(escapeHtml('a"b')).toBe('a&quot;b');
    expect(escapeHtml("O'Brien")).toBe('O&#39;Brien');
  });

  it('escapes the ampersand first, so an escape is not double escaped', () => {
    expect(escapeHtml('a & <b>')).toBe('a &amp; &lt;b&gt;');
  });
});

describe('toPlainText', () => {
  it('strips markup and puts the entities back', () => {
    expect(toPlainText('<b>O&#39;Brien</b> &amp; co')).toBe("O'Brien & co");
  });

  it('turns a line break tag into an actual newline', () => {
    expect(toPlainText('one<br>two')).toBe('one\ntwo');
  });
});

describe('emailShell', () => {
  const base = { title: 'Reset your password', paragraphs: ['Body copy.'] };

  it('always produces a plain text part as well as HTML', () => {
    // A message with no plain alternative scores worse with spam filters and
    // is unreadable in a client that blocks HTML.
    const { html, text } = emailShell(base);
    expect(html).toContain('<!DOCTYPE html>');
    expect(text).toContain('Reset your password');
    expect(text).toContain('Body copy.');
    expect(text).not.toContain('<');
  });

  it('escapes the title everywhere it appears', () => {
    const { html } = emailShell({ ...base, title: 'A <script> title' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes a greeting, which is where a user name arrives', () => {
    const { html } = emailShell({
      ...base,
      greeting: escapeHtml('Hi <img onerror=x>,'),
    });
    expect(html).not.toContain('<img');
  });

  it('escapes a code, and renders it as text so it can be copied', () => {
    const { html } = emailShell({ ...base, code: 'Temp<>Pass' });
    expect(html).toContain('Temp&lt;&gt;Pass');
  });

  it('omits the CTA block entirely when there is no CTA', () => {
    // An email whose payload is a code does not need a button, and the "if the
    // button doesn't work" fallback under it would be noise.
    const { html, text } = emailShell({ ...base, code: '123456' });
    expect(html).not.toContain('If the button does not work');
    expect(text).not.toContain('undefined');
  });

  it('renders the CTA and its copyable fallback when there is one', () => {
    const url = 'https://app.example.com/reset-password?token=abc';
    const { html, text } = emailShell({
      ...base,
      ctaLabel: 'Choose a new password',
      ctaUrl: url,
    });
    expect(html).toContain(`href="${url}"`);
    expect(html).toContain('If the button does not work');
    expect(text).toContain(`Choose a new password: ${url}`);
  });

  it('carries a hidden preheader, so the inbox preview is not random body text', () => {
    const { html } = emailShell(base);
    expect(html).toContain('display:none;max-height:0');
  });

  it('locks the colour scheme, so a dark mode client does not invert the card', () => {
    const { html } = emailShell(base);
    expect(html).toContain('color-scheme');
  });

  it('lays out with tables, because Outlook renders with Word', () => {
    const { html } = emailShell(base);
    expect(html).toContain('role="presentation"');
    expect(html).not.toContain('display:flex');
    expect(html).not.toContain('display:grid');
  });
});
