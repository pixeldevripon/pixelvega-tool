/**
 * String utilities shared by every email template.
 *
 * They are their own file rather than living inside the shell, so a template
 * that needs escaping does not have to import it from a module named for
 * something else.
 */

/**
 * Escape the HTML significant characters, so data can never inject markup.
 *
 * Quotes are escaped as well as the angle brackets, because these values land
 * inside `href="..."` and `style="..."` attributes, where a bare quote breaks
 * out of the attribute rather than merely rendering oddly.
 *
 * The previous invite template interpolated a user's name straight into its
 * HTML, so a display name could carry markup into every recipient's inbox.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The plain text view of a fragment of email HTML.
 *
 * Strips markup and puts back the entities `escapeHtml` introduced, so a name
 * reads as `O'Brien` in the text/plain alternative rather than `O&#39;Brien`.
 */
export function toPlainText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}
