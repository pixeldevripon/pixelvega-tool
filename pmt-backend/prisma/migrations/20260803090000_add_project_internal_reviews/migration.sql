-- AlterEnum
ALTER TYPE "ProjectActivityType" ADD VALUE 'INTERNAL_FEEDBACK_RECEIVED';

-- CreateEnum
CREATE TYPE "InternalReviewDecision" AS ENUM ('APPROVED', 'CHANGES_REQUIRED');

-- CreateTable
CREATE TABLE "ProjectInternalReview" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reviewedById" TEXT NOT NULL,
    "decision" "InternalReviewDecision" NOT NULL,
    "comments" TEXT,
    "reviewRound" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectInternalReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectInternalReview_projectId_reviewRound_key" ON "ProjectInternalReview"("projectId", "reviewRound");

-- CreateIndex
CREATE INDEX "ProjectInternalReview_projectId_idx" ON "ProjectInternalReview"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectInternalReview" ADD CONSTRAINT "ProjectInternalReview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInternalReview" ADD CONSTRAINT "ProjectInternalReview_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
