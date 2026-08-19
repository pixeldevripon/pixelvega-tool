-- AlterTable
ALTER TABLE "DailyWorkReport" ADD COLUMN "planFeedSlackTs" TEXT,
ADD COLUMN "wrapUpFeedSlackTs" TEXT;

-- AlterTable
ALTER TABLE "DailyProjectEntry" DROP COLUMN "planFeedSlackTs",
DROP COLUMN "wrapUpFeedSlackTs";
