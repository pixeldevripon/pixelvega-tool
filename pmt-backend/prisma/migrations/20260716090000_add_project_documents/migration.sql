-- CreateEnum
CREATE TYPE "ProjectDocumentType" AS ENUM ('PRD', 'REQUIREMENT', 'MEETING_NOTE', 'CREDENTIAL', 'ASSET', 'DELIVERABLE');

-- CreateEnum
CREATE TYPE "ProjectDocumentFormat" AS ENUM ('TEXT', 'FILE');

-- AlterEnum
ALTER TYPE "ProjectActivityType" ADD VALUE 'DOCUMENT_ADDED';
ALTER TYPE "ProjectActivityType" ADD VALUE 'DOCUMENT_UPDATED';
ALTER TYPE "ProjectActivityType" ADD VALUE 'DOCUMENT_REMOVED';

-- CreateTable
CREATE TABLE "ProjectDocument" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "description" TEXT,
    "type" "ProjectDocumentType" NOT NULL,
    "format" "ProjectDocumentFormat" NOT NULL DEFAULT 'FILE',
    "title" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileMimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "textContent" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectDocument_projectId_idx" ON "ProjectDocument"("projectId");

-- CreateIndex
CREATE INDEX "ProjectDocument_type_idx" ON "ProjectDocument"("type");

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
