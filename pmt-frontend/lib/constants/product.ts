/**
 * The product's name, in one place.
 *
 * Every surface that says the name reads it from here: the browser title, the
 * login door, the sidebar wordmark's alt text, and the emails the backend
 * sends. Renaming the product should be one edit, not a grep.
 *
 * "Vega" was chosen over the internal working title ("PixelVega PMT") for the
 * reason a tool gets a short name: people type it, say it in standups, and use
 * it as a verb. It is already half of the company name, and the design system
 * in `app/globals.css` was built under the same word, so nothing has to be
 * re-learned.
 *
 * PIXELVEGA is the company. VEGA is the tool. The wordmark in the sidebar is
 * the company's; the title bar and the login door say the tool's.
 */
export const PRODUCT_NAME = 'Vega';

/** The company that makes it. Used where the wordmark needs alt text. */
export const COMPANY_NAME = 'PixelVega';

/** One line, for the login door and the browser title's suffix. */
export const PRODUCT_TAGLINE = 'Project management for the studio';
