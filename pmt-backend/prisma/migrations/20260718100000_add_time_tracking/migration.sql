-- CreateEnum
CREATE TYPE "TimeEntryStatus" AS ENUM ('RUNNING', 'PAUSED', 'STOPPED');

-- AlterEnum
ALTER TYPE "ProjectActivityType" ADD VALUE 'TIME_STARTED';
ALTER TYPE "ProjectActivityType" ADD VALUE 'TIME_PAUSED';
ALTER TYPE "ProjectActivityType" ADD VALUE 'TIME_RESUMED';
ALTER TYPE "ProjectActivityType" ADD VALUE 'TIME_STOPPED';
ALTER TYPE "ProjectActivityType" ADD VALUE 'ESTIMATED_HOURS_CHANGED';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "estimatedHours" DOUBLE PRECISION,
ADD COLUMN "actualHours" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" "TimeEntryStatus" NOT NULL DEFAULT 'RUNNING',
    "notes" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimeEntry_projectId_idx" ON "TimeEntry"("projectId");

-- CreateIndex
CREATE INDEX "TimeEntry_userId_idx" ON "TimeEntry"("userId");

-- CreateIndex
CREATE INDEX "TimeEntry_userId_status_idx" ON "TimeEntry"("userId", "status");

-- CreateIndex
CREATE INDEX "TimeEntry_sessionId_idx" ON "TimeEntry"("sessionId");

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
