-- The landing screen's permission.
--
-- Hand written rather than generated: `prisma migrate dev` needs a TTY, which
-- an agent session does not have, so the folder and this file are written and
-- applied with `prisma migrate deploy`.
--
-- Adding a value to a Postgres enum is not transactional in the same way as a
-- table change: it cannot be rolled back inside the migration, and it cannot be
-- used in the same transaction that adds it. Neither matters here, because
-- nothing in this migration reads the new value.

-- AlterEnum
ALTER TYPE "Permission" ADD VALUE 'VIEW_DASHBOARD';
