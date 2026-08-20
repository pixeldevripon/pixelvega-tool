-- Each user gets their own weekly off day instead of the whole team sharing
-- one hardcoded Friday. Existing rows default to FRIDAY, unchanged until a
-- PROJECT_MANAGER or ADMIN explicitly sets a different day.
--
-- Hand written rather than generated: `prisma migrate dev` needs a TTY, which
-- an agent session does not have, so the folder and this file are written and
-- applied with `prisma migrate deploy`.
--
-- Adding a value to a Postgres enum is not transactional in the same way as a
-- table change: it cannot be used in the same transaction that adds it.
-- Nothing below reads MANAGE_WEEKLY_OFF_DAY, so combining it with the new
-- Weekday type and column in one migration is safe.

-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('FRIDAY', 'SATURDAY');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "weeklyOffDay" "Weekday" NOT NULL DEFAULT 'FRIDAY';

-- AlterEnum
ALTER TYPE "Permission" ADD VALUE 'MANAGE_WEEKLY_OFF_DAY';
