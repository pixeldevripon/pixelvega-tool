-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SYSTEM_ADMIN', 'ADMIN', 'PROJECT_MANAGER', 'DEVELOPER', 'CLIENT');

-- AlterTable: role was a free-form TEXT column; every existing value already
-- matches one of the enum members above, so this cast is safe.
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING ("role"::"Role");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'DEVELOPER';
