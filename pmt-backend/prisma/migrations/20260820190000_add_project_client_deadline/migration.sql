-- Splits the single "deadline" into the internal/working date and the date
-- actually promised to the client, so a DEVELOPER/DESIGNER and a CLIENT can be
-- shown different facts without either one being a lie.
--
-- Hand written rather than generated: `prisma migrate dev` needs a TTY, which
-- an agent session does not have, so the folder and this file are written and
-- applied with `prisma migrate deploy`.
--
-- Adding a value to a Postgres enum is not transactional in the same way as a
-- table change: it cannot be used in the same transaction that adds it.
-- Nothing below reads CLIENT_DEADLINE_CHANGED, so combining it with the column
-- add in one migration is safe.

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "clientDeadline" TIMESTAMP(3);

-- AlterEnum
ALTER TYPE "ProjectActivityType" ADD VALUE 'CLIENT_DEADLINE_CHANGED';
