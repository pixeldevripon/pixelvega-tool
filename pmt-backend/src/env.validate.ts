/**
 * Fail at boot, not at first use.
 *
 * Every variable the application reads is declared here. A missing or
 * placeholder value stops the process with a named error, rather than
 * surfacing hours later as a confusing runtime failure in whichever feature
 * happened to touch it first.
 *
 * Keep this in step with `.env.example`, which is the human facing copy of the
 * same list.
 *
 * Mirrors the reference backend's `src/env.validate.ts`.
 */

/** A validator returns null when the value is acceptable, or a reason string. */
type Validator = (value: string) => string | null;

const PLACEHOLDER_MARKERS = [
  'change-me',
  'CHANGE_ME',
  'REPLACE_ME',
  'yourPassword',
];

/** Reusable: a secret long enough to be real, and not a shipped placeholder. */
const secret =
  (minLength: number): Validator =>
  (value) => {
    if (value.length < minLength)
      return `must be at least ${minLength} characters`;
    if (PLACEHOLDER_MARKERS.some((marker) => value.includes(marker)))
      return 'placeholder detected, generate a real secret: openssl rand -base64 32';
    return null;
  };

/** Reusable: a positive integer, for ports and tuning knobs. */
const positiveInt: Validator = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0
    ? null
    : 'must be a positive integer';
};

const anyValue: Validator = () => null;

/**
 * Required. The app cannot serve a request without every one of these, so a
 * missing value is a hard failure.
 */
const REQUIRED: Record<string, Validator> = {
  DATABASE_URL: (value) =>
    value.startsWith('postgres://') || value.startsWith('postgresql://')
      ? null
      : 'must be a postgres connection string',

  // Signs every session cookie. Rotating it invalidates all sessions.
  BETTER_AUTH_SECRET: secret(32),

  // Also used as the login URL in the invite email, so it must be the address
  // a human can actually open, not an internal hostname.
  BETTER_AUTH_URL: anyValue,

  NODE_ENV: (value) =>
    ['development', 'production', 'test'].includes(value)
      ? null
      : 'must be one of: development, production, test',

  PORT: positiveInt,

  // Comma separated allowlist. Never a wildcard: this API sets
  // credentials: true, and browsers refuse that combination with '*', so a
  // wildcard here breaks every authenticated call rather than relaxing CORS.
  CORS_ORIGINS: (value) => {
    if (value.trim().length === 0)
      return 'must be a non-empty comma separated list of origins';
    if (value.includes('*'))
      return 'must not contain a wildcard, this API sends credentials';
    return null;
  },

  // The one SYSTEM_ADMIN, created on first boot against an empty database and
  // by `pnpm seed`. Without these the very first user cannot exist, and nobody
  // can reach POST /users/invite.
  //
  // The password is here rather than generated because this account is the root
  // of the whole permission model: an operator has to be able to sign in as it
  // without an inbox. Every other account is invited and sets its own.
  ADMIN_EMAIL: (value) =>
    value.includes('@') ? null : 'must be an email address',
  ADMIN_NAME: anyValue,
  ADMIN_PASSWORD: (value) => {
    // better-auth's own floor. Its sign up rejects anything shorter, so without
    // this bound the failure arrives as an opaque library error from inside the
    // bootstrap, or from the seed after it has already truncated every table,
    // instead of as a named variable at boot.
    if (value.length < 8) return 'must be at least 8 characters';
    if (PLACEHOLDER_MARKERS.some((marker) => value.includes(marker)))
      return 'placeholder detected, set a real password for the root account';
    return null;
  },
};

/**
 * Optional, but validated when present. Each of these gates one feature, and
 * every one of those features degrades to a no-op without its key rather than
 * crashing the app.
 */
const OPTIONAL: Record<string, Validator> = {
  /**
   * Where a password reset link points.
   *
   * Optional: it falls back to the first CORS_ORIGINS entry, which is the
   * dashboard in every environment this runs in. Set it explicitly when the
   * dashboard is not the first origin in that list.
   */
  APP_URL: anyValue,

  /**
   * Shared secret identifying a first party server rendered caller, which may
   * then bypass the per IP throttle on routes that have not tightened their own
   * limit, and forward the real visitor's IP.
   *
   * Optional. Unset means the bypass never triggers, so a deployment that
   * forgets it is throttled rather than open.
   */
  INTERNAL_API_SECRET: secret(16),

  /**
   * Turns OFF better-auth's origin check, which is CSRF protection.
   *
   * Optional, and deliberately opt in by explicit value rather than inferred
   * from NODE_ENV. It used to be disabled for everything that was not exactly
   * "production", which meant staging ran with no origin check at all.
   */
  AUTH_DISABLE_ORIGIN_CHECK: anyValue,

  /**
   * Attempts per minute, per IP, on sign-in and the three password routes.
   *
   * Optional. Unset means 5, which is the production value and the defence
   * against password guessing. Raise it locally, where the browser, the Next
   * route guard and server-side rendering all arrive as one IP and a single
   * page load can spend several attempts.
   *
   * Opt in by explicit value, for the same reason AUTH_DISABLE_ORIGIN_CHECK is:
   * a limit inferred from NODE_ENV left staging unprotected.
   */
  AUTH_SENSITIVE_RATE_LIMIT_MAX: positiveInt,

  // Mail. Without these, invite and password reset emails are not delivered.
  SMTP_HOST: anyValue,
  SMTP_PORT: positiveInt,
  SMTP_USER: anyValue,
  SMTP_PASS: anyValue,
  MAIL_FROM: anyValue,

  // Cloudinary: avatars and project documents.
  CLOUDINARY_CLOUD_NAME: anyValue,
  CLOUDINARY_API_KEY: anyValue,
  CLOUDINARY_API_SECRET: anyValue,

  // Slack. Every SlackService call no-ops safely without a token.
  SLACK_BOT_TOKEN: anyValue,
  SLACK_DAILY_FEED_CHANNEL_ID: anyValue,

  // AI. The queued features fail their job without these; the app still boots.
  ANTHROPIC_API_KEY: anyValue,
  REDIS_URL: anyValue,
};

/**
 * Validate the process environment. Call this as the very first statement in
 * bootstrap(), before Nest builds the module graph, so a bad value is reported
 * before anything else can fail confusingly downstream.
 *
 * @throws Error listing every problem at once, rather than only the first.
 */
export function validateEnv(env: NodeJS.ProcessEnv = process.env): void {
  const problems: string[] = [];

  for (const [name, validate] of Object.entries(REQUIRED)) {
    const value = env[name];
    if (value === undefined || value === '') {
      problems.push(`  ${name} is required but is not set`);
      continue;
    }
    const reason = validate(value);
    if (reason) problems.push(`  ${name} ${reason}`);
  }

  for (const [name, validate] of Object.entries(OPTIONAL)) {
    const value = env[name];
    if (value === undefined || value === '') continue;
    const reason = validate(value);
    if (reason) problems.push(`  ${name} ${reason}`);
  }

  if (problems.length > 0) {
    throw new Error(
      `\n\nEnvironment validation failed:\n\n${problems.join('\n')}\n\n` +
        'See .env.example for the full list and the expected shape of each value.\n',
    );
  }
}

/** Exported for the spec, so the lists cannot drift from what is tested. */
export const ENV_KEYS = {
  required: Object.keys(REQUIRED),
  optional: Object.keys(OPTIONAL),
};
