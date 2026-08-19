// globalSetup runs in Jest's main CJS process, so it must be plain JS rather
// than a ts-jest module.
//
// Two jobs, in order:
//   1. Refuse to run unless .env.test exists AND points somewhere that is
//      definitely not the development or production database.
//   2. Apply every pending migration to that test database.
const dotenv = require('dotenv');
const path = require('path');
const { existsSync, readFileSync } = require('fs');
const { execSync } = require('child_process');

const BACKEND_ROOT = path.resolve(__dirname, '..');

/** Read one variable out of an env file without mutating process.env. */
function readEnvValue(filePath, key) {
  if (!existsSync(filePath)) return undefined;
  return dotenv.parse(readFileSync(filePath))[key];
}

/**
 * Strip credentials and query parameters so two URLs pointing at the same
 * database compare equal even when one carries a different password or a
 * sslmode flag. Returns `host/port/database`, lowercased.
 */
function databaseIdentity(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port}${parsed.pathname}`.toLowerCase();
  } catch {
    // Not parseable as a URL. Fall back to the raw string so an exact match is
    // still caught rather than silently allowed through.
    return String(url).toLowerCase();
  }
}

module.exports = async function globalSetup() {
  const testEnvPath = path.join(BACKEND_ROOT, '.env.test');

  if (!existsSync(testEnvPath)) {
    throw new Error(
      '\n\n.env.test not found.\n' +
        '  cp pmt-backend/.env.test.example pmt-backend/.env.test\n' +
        'Then set DATABASE_URL to a dedicated test database.\n',
    );
  }

  dotenv.config({ path: testEnvPath, override: true });

  if (!process.env.DATABASE_URL) {
    throw new Error('.env.test is missing DATABASE_URL');
  }

  // ── The guard ──────────────────────────────────────────────────────────────
  // The suite truncates tables. Pointing it at the development database would
  // wipe real work, and at production would be unrecoverable. Compare against
  // .env rather than trusting the name to contain "test".
  const devUrl = readEnvValue(path.join(BACKEND_ROOT, '.env'), 'DATABASE_URL');
  if (devUrl && databaseIdentity(devUrl) === databaseIdentity(process.env.DATABASE_URL)) {
    throw new Error(
      '\n\nREFUSING TO RUN: .env.test DATABASE_URL points at the SAME database as .env.\n' +
        `  ${databaseIdentity(process.env.DATABASE_URL)}\n` +
        'The E2E suite truncates tables. Point .env.test at a dedicated test database.\n',
    );
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('REFUSING TO RUN: NODE_ENV is production.');
  }

  execSync('npx prisma migrate deploy', {
    cwd: BACKEND_ROOT,
    env: { ...process.env },
    stdio: 'inherit',
  });
};
