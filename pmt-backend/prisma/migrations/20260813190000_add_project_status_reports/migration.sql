-- AlterEnum
ALTER TYPE "ProjectActivityType" ADD VALUE 'AI_STATUS_REPORT_GENERATED';

-- CreateEnum
CREATE TYPE "StatusReportType" AS ENUM ('STATUS_UPDATE');

-- CreateTable
CREATE TABLE "ProjectStatusReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reportType" "StatusReportType" NOT NULL DEFAULT 'STATUS_UPDATE',
    "content" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "model" TEXT NOT NULL,
    "templateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectStatusReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectStatusReport_projectId_idx" ON "ProjectStatusReport"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectStatusReport" ADD CONSTRAINT "ProjectStatusReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStatusReport" ADD CONSTRAINT "ProjectStatusReport_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStatusReport" ADD CONSTRAINT "ProjectStatusReport_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AiTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
