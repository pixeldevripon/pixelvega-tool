-- CreateEnum
CREATE TYPE "AdditionalRequirementStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "ProjectActivityType" ADD VALUE 'ADDITIONAL_REQUIREMENT_ADDED';
ALTER TYPE "ProjectActivityType" ADD VALUE 'ADDITIONAL_REQUIREMENT_REVIEWED';

-- CreateTable
CREATE TABLE "AdditionalRequirement" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sourceChannel" TEXT,
    "aiScopeAnalysis" JSONB,
    "status" "AdditionalRequirementStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "uploadedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedAdditionalHours" DOUBLE PRECISION,
    "deadlineExtensionDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdditionalRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdditionalRequirement_projectId_idx" ON "AdditionalRequirement"("projectId");

-- CreateIndex
CREATE INDEX "AdditionalRequirement_status_idx" ON "AdditionalRequirement"("status");

-- AddForeignKey
ALTER TABLE "AdditionalRequirement" ADD CONSTRAINT "AdditionalRequirement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdditionalRequirement" ADD CONSTRAINT "AdditionalRequirement_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdditionalRequirement" ADD CONSTRAINT "AdditionalRequirement_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
