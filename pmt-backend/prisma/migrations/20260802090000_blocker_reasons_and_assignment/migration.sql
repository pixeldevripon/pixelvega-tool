-- AlterEnum
ALTER TYPE "ProjectActivityType" ADD VALUE 'BLOCKER_ASSIGNED';

-- Rename BlockerCategory -> BlockerReason (table + pkey constraint).
ALTER TABLE "BlockerCategory" RENAME TO "BlockerReason";
ALTER TABLE "BlockerReason" RENAME CONSTRAINT "BlockerCategory_pkey" TO "BlockerReason_pkey";

-- Replace the plain unique index on name with a partial one scoped to active
-- rows, so a reason's name can be reused by a new one once it's soft deleted.
DROP INDEX "BlockerCategory_name_key";
CREATE UNIQUE INDEX "BlockerReason_name_active_key" ON "BlockerReason"("name") WHERE "deletedAt" IS NULL;

-- Rename Blocker.categoryId -> reasonId (FK/index follow the column rename;
-- the FK itself survives the table rename above without being dropped).
ALTER TABLE "Blocker" RENAME COLUMN "categoryId" TO "reasonId";
ALTER TABLE "Blocker" RENAME CONSTRAINT "Blocker_categoryId_fkey" TO "Blocker_reasonId_fkey";
ALTER INDEX "Blocker_categoryId_idx" RENAME TO "Blocker_reasonId_idx";

-- AlterTable: assignment and deadline impact tracking
ALTER TABLE "Blocker" ADD COLUMN "assignedToId" TEXT;
ALTER TABLE "Blocker" ADD COLUMN "assignedAt" TIMESTAMP(3);
ALTER TABLE "Blocker" ADD COLUMN "deadlineExtensionDays" INTEGER;

-- CreateIndex
CREATE INDEX "Blocker_assignedToId_idx" ON "Blocker"("assignedToId");

-- AddForeignKey
ALTER TABLE "Blocker" ADD CONSTRAINT "Blocker_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
