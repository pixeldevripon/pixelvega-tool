-- CreateTable
CREATE TABLE "BlockerCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BlockerCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlockerCategory_name_key" ON "BlockerCategory"("name");

-- Seed the fallback category BlockerService.addBlocker() assigns when a
-- blocker is reported without an explicit categoryId. Protected from
-- rename/delete in BlockerCategoriesService.
INSERT INTO "BlockerCategory" ("id", "name", "updatedAt")
VALUES (gen_random_uuid(), 'Uncategorized', CURRENT_TIMESTAMP);

-- AlterTable: add categoryId nullable first so existing rows can be
-- backfilled, then enforce NOT NULL.
ALTER TABLE "Blocker" ADD COLUMN "categoryId" TEXT;

UPDATE "Blocker"
SET "categoryId" = (SELECT "id" FROM "BlockerCategory" WHERE "name" = 'Uncategorized');

ALTER TABLE "Blocker" ALTER COLUMN "categoryId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Blocker_categoryId_idx" ON "Blocker"("categoryId");

-- AddForeignKey
ALTER TABLE "Blocker" ADD CONSTRAINT "Blocker_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BlockerCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
