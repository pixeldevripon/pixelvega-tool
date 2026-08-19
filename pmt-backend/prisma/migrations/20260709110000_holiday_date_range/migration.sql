-- AlterTable: turn a single "date" into a startDate/endDate range.
-- Backfills endDate = startDate so any existing single-day rows stay correct.
ALTER TABLE "Holiday" RENAME COLUMN "date" TO "startDate";
ALTER TABLE "Holiday" ADD COLUMN "endDate" TIMESTAMP(3);
UPDATE "Holiday" SET "endDate" = "startDate" WHERE "endDate" IS NULL;
ALTER TABLE "Holiday" ALTER COLUMN "endDate" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_name_startDate_key" ON "Holiday"("name", "startDate");
