-- AlterEnum
ALTER TYPE "ProjectActivityType" ADD VALUE 'BLOCKER_ADDED';
ALTER TYPE "ProjectActivityType" ADD VALUE 'BLOCKER_STATUS_CHANGED';

-- CreateEnum
CREATE TYPE "BlockerStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "BlockerSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "Blocker" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "BlockerStatus" NOT NULL DEFAULT 'OPEN',
    "severity" "BlockerSeverity" NOT NULL DEFAULT 'MEDIUM',
    "reportedById" TEXT NOT NULL,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Blocker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Blocker_projectId_idx" ON "Blocker"("projectId");

-- CreateIndex
CREATE INDEX "Blocker_status_idx" ON "Blocker"("status");

-- CreateIndex
CREATE INDEX "Blocker_severity_idx" ON "Blocker"("severity");

-- CreateIndex
CREATE INDEX "Blocker_createdAt_idx" ON "Blocker"("createdAt");

-- AddForeignKey
ALTER TABLE "Blocker" ADD CONSTRAINT "Blocker_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blocker" ADD CONSTRAINT "Blocker_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blocker" ADD CONSTRAINT "Blocker_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
