import { escapeHtml, toPlainText } from '@/mail/templates/email-text.util';

/**
 * The shared shell every PixelVega email is built on.
 *
 * ── Why a shell rather than per template HTML ──
 * Before this, each template hand wrote a handful of `<p>` tags. That means
 * every new email is a fresh chance to forget the preheader, the plain text
 * alternative, the dark mode lock, or to escape a name; and the family drifts
 * apart one template at a time. One shell means a template supplies only its
 * words, and gets the rest right by construction.
 *
 * ── Why tables and inline styles ──
 * Not nostalgia. Outlook renders with Word's engine, which supports neither
 * flexbox nor grid, and Gmail strips `<style>` blocks on forwarded mail. A
 * table with inline styles is what actually survives.
 */

/** Brand, matching the dashboard's own tokens (`globals.css`). */
const BRAND = {
  ink: '#111827',
  muted: '#6b7280',
  faint: '#9ca3af',
  hairline: '#e5e7eb',
  page: '#f6f7fb',
  card: '#ffffff',
  primary: '#4a3bd8',
} as const;

export interface EmailShellProps {
  /** Used for `<title>`, the hidden preheader, and the headline. */
  title: string;
  /** The "Hi Name," line. Escape it: it usually carries a user's name. */
  greeting?: string;
  /** Body copy. Developer authored, so inline markup is allowed. */
  paragraphs: string[];
  /**
   * A one time value shown as the centrepiece rather than buried in a
   * sentence: a temporary password, a code. Escaped, and rendered as text so
   * it survives image blocking and can still be copied.
   */
  code?: string;
  /** The line under the code, e.g. "Expires in 60 minutes". */
  codeNote?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  /** A muted line under the CTA, e.g. "If you did not ask for this...". */
  footnote?: string;
}

export interface RenderedEmail {
  html: string;
  /**
   * The text/plain alternative, built from the same inputs.
   *
   * Not optional: a message with no plain part scores worse with spam filters,
   * and is unreadable in a client that blocks HTML.
   */
  text: string;
}

export function emailShell({
  title,
  greeting,
  paragraphs,
  code,
  codeNote,
  ctaLabel,
  ctaUrl,
  footnote,
}: EmailShellProps): RenderedEmail {
  const line = (content: string) =>
    `<div style="font-size:16px;font-weight:400;color:${BRAND.muted};line-height:1.65;margin-bottom:14px">${content}</div>`;

  const bodyBlocks = [
    ...(greeting ? [line(greeting)] : []),
    ...paragraphs.map(line),
  ].join('\n          ');

  // No tinted panel and no border: emphasis in this family is type, so the
  // code is simply the biggest thing on the page.
  const codeBlock = code
    ? `
          <div style="font-size:30px;font-weight:600;letter-spacing:.12em;line-height:1.2;color:${BRAND.ink};margin:4px 0 8px;word-break:break-all">${escapeHtml(code)}</div>
          ${codeNote ? `<div style="font-size:14px;font-weight:400;color:${BRAND.faint};margin-bottom:16px">${escapeHtml(codeNote)}</div>` : ''}`
    : '';

  // Optional: an email whose payload is a code does not need a button, and the
  // "if the button doesn't work" fallback under it would be noise.
  const ctaBlock =
    ctaLabel && ctaUrl
      ? `
          <a href="${ctaUrl}" style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;color:#ffffff;background:${BRAND.primary};text-decoration:none;border-radius:10px;padding:13px 24px;margin-top:4px">${escapeHtml(ctaLabel)}</a>

          <div style="font-size:13px;font-weight:400;color:${BRAND.faint};margin-top:18px;line-height:1.65">If the button does not work, copy this link into your browser:<br>
            <a href="${ctaUrl}" style="color:${BRAND.muted};word-break:break-all">${ctaUrl}</a>
          </div>`
      : '';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(title)}</title>
  <style>
    /* Lock the palette. Clients that honour color-scheme (Apple Mail, iOS)
       then stop inverting the card in dark mode and rendering the ink on ink. */
    :root { color-scheme: light; supported-color-schemes: light; }
    @media only screen and (max-width: 480px) {
      .pv-shell { padding: 12px 6px !important; }
      .pv-cell { padding-left: 18px !important; padding-right: 18px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${BRAND.page};font-family:Arial,Helvetica,sans-serif;color:${BRAND.ink};">
  <!-- Preheader: the grey line an inbox shows after the subject. Hidden in the
       body so it does not also appear at the top of the message. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(title)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${BRAND.page}">
    <tr><td align="center" class="pv-shell" style="padding:28px 16px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${BRAND.card};border-radius:16px;border:1px solid ${BRAND.hairline};border-collapse:separate">

        <tr><td class="pv-cell" style="padding:20px 28px;border-bottom:1px solid ${BRAND.hairline}">
          <span style="font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:${BRAND.ink}">PIXEL<span style="color:${BRAND.primary}">VEGA</span></span>
        </td></tr>

        <tr><td class="pv-cell" style="padding:30px 28px 4px">
          <div style="font-size:24px;font-weight:600;letter-spacing:-.01em;line-height:1.3;color:${BRAND.ink}">${escapeHtml(title)}</div>
        </td></tr>

        <tr><td class="pv-cell" style="padding:18px 28px 4px">
          ${bodyBlocks}${codeBlock}${ctaBlock}
          ${footnote ? `\n          <div style="font-size:13px;font-weight:400;color:${BRAND.faint};margin-top:14px;line-height:1.65">${footnote}</div>` : ''}
        </td></tr>

        <tr><td class="pv-cell" style="padding:26px 28px">
          <div style="border-top:1px solid ${BRAND.hairline};padding-top:20px">
            <div style="font-size:14px;font-weight:600;color:${BRAND.ink}">PixelVega</div>
            <div style="font-size:13px;font-weight:400;color:${BRAND.faint};margin-top:10px;line-height:1.65">This is a transactional account email, sent because someone acted on your PixelVega account.</div>
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();

  const text = [
    title,
    '='.repeat(title.length),
    '',
    ...(greeting ? [toPlainText(greeting), ''] : []),
    ...paragraphs.map(toPlainText),
    ...(code ? ['', code, ...(codeNote ? [codeNote] : [])] : []),
    ...(ctaLabel && ctaUrl ? ['', `${ctaLabel}: ${ctaUrl}`] : []),
    ...(footnote ? ['', toPlainText(footnote)] : []),
    '',
    'PixelVega',
    'This is a transactional account email.',
  ].join('\n');

  return { html, text };
}
