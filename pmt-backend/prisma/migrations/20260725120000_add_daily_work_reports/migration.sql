-- AlterEnum
ALTER TYPE "ProjectActivityType" ADD VALUE 'PLAN_SUBMITTED';
ALTER TYPE "ProjectActivityType" ADD VALUE 'PLAN_UPDATED';
ALTER TYPE "ProjectActivityType" ADD VALUE 'WRAP_UP_SUBMITTED';
ALTER TYPE "ProjectActivityType" ADD VALUE 'WRAP_UP_UPDATED';
ALTER TYPE "ProjectActivityType" ADD VALUE 'WORK_REPORT_REVIEWED';

-- CreateEnum
CREATE TYPE "DailyWorkReportStatus" AS ENUM ('DRAFT', 'PLAN_SUBMITTED', 'COMPLETED');

-- CreateTable
CREATE TABLE "DailyWorkReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "DailyWorkReportStatus" NOT NULL DEFAULT 'PLAN_SUBMITTED',
    "planSubmittedAt" TIMESTAMP(3),
    "wrapUpSubmittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyWorkReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyProjectEntry" (
    "id" TEXT NOT NULL,
    "dailyWorkReportId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "plan" TEXT,
    "accomplishments" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyProjectEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyWorkReport_userId_idx" ON "DailyWorkReport"("userId");

-- CreateIndex
CREATE INDEX "DailyWorkReport_date_idx" ON "DailyWorkReport"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyWorkReport_userId_date_key" ON "DailyWorkReport"("userId", "date");

-- CreateIndex
CREATE INDEX "DailyProjectEntry_projectId_idx" ON "DailyProjectEntry"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyProjectEntry_dailyWorkReportId_projectId_key" ON "DailyProjectEntry"("dailyWorkReportId", "projectId");

-- AddForeignKey
ALTER TABLE "DailyWorkReport" ADD CONSTRAINT "DailyWorkReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyProjectEntry" ADD CONSTRAINT "DailyProjectEntry_dailyWorkReportId_fkey" FOREIGN KEY ("dailyWorkReportId") REFERENCES "DailyWorkReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyProjectEntry" ADD CONSTRAINT "DailyProjectEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyProjectEntry" ADD CONSTRAINT "DailyProjectEntry_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
