-- The account screen's personal fields, plus the three self-service permissions
-- it needs.
--
-- Hand written rather than generated: `prisma migrate dev` needs a TTY, which an
-- agent session does not have, so the folder and this file are written and then
-- applied with `prisma migrate deploy`.
--
-- Adding a value to a Postgres enum cannot be used in the same transaction that
-- adds it. Nothing below reads the three new Permission values, and the Gender
-- column added further down references a type this migration CREATES rather
-- than extends, so neither restriction applies here.

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY');

-- AlterEnum
ALTER TYPE "Permission" ADD VALUE 'VIEW_OWN_SESSIONS';
ALTER TYPE "Permission" ADD VALUE 'MANAGE_OWN_SESSIONS';
ALTER TYPE "Permission" ADD VALUE 'DELETE_OWN_ACCOUNT';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "country" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "socialUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Backfill the two halves from the full name every existing row already has, so
-- the account form opens populated rather than blank for everyone who predates
-- this migration.
--
-- Split on the FIRST space: "Jabed Hossain Khan" becomes "Jabed" + "Hossain
-- Khan". A last-space split would produce "Jabed Hossain" + "Khan", which reads
-- equally plausible in English and is wrong for the many naming conventions
-- where the family name comes first. Neither split is right for every name,
-- which is exactly why both halves are editable afterwards.
UPDATE "User"
SET
  "firstName" = NULLIF(SPLIT_PART(TRIM("name"), ' ', 1), ''),
  "lastName"  = NULLIF(TRIM(SUBSTRING(TRIM("name") FROM POSITION(' ' IN TRIM("name")) + 1)), '')
WHERE "name" IS NOT NULL;

-- A single-word name leaves lastName holding a copy of it, because
-- POSITION returns 0 and SUBSTRING FROM 1 returns the whole string. Clear it:
-- "Madonna" has a first name and no last name, not the same name twice.
UPDATE "User"
SET "lastName" = NULL
WHERE POSITION(' ' IN TRIM("name")) = 0;
