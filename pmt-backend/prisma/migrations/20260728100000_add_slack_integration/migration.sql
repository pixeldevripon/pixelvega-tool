-- AlterTable
ALTER TABLE "User" ADD COLUMN "slackUserId" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "slackChannelId" TEXT;

-- AlterTable
ALTER TABLE "DailyProjectEntry" ADD COLUMN "planProjectSlackTs" TEXT,
ADD COLUMN "planFeedSlackTs" TEXT,
ADD COLUMN "wrapUpProjectSlackTs" TEXT,
ADD COLUMN "wrapUpFeedSlackTs" TEXT;
