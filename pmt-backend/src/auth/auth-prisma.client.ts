import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * The pre-DI Prisma client, used by everything that runs before the Nest app
 * exists: better-auth in `auth.instance.ts` and its database hooks.
 *
 * It lives in its own file, rather than inside `auth.instance.ts`, so that
 * `AuthModule` can disconnect it on shutdown without importing the whole
 * better-auth instance, and so nothing has to reach through the auth module to
 * get at a database client.
 *
 * ── This is the SECOND pool in the process ──
 * `PrismaService` owns the first. Sizing Postgres has to count both:
 * `max_connections >= (app pool + this pool) x processes + headroom`. It is
 * capped low on purpose: session validation is many tiny reads and never
 * lock contended, so ten is plenty and leaves the app pool the headroom.
 *
 * The timeouts are here because the defaults are "wait forever". Without them
 * a database hiccup during a sign-in rush queues connections indefinitely
 * instead of failing fast.
 */
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
});

export const authPrismaClient = new PrismaClient({ adapter });
