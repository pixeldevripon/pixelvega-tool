-- CreateEnum
CREATE TYPE "AiTemplateKind" AS ENUM ('PROJECT_SUMMARY', 'STATUS_REPORT');

-- CreateTable
CREATE TABLE "AiTemplate" (
    "id" TEXT NOT NULL,
    "kind" "AiTemplateKind" NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiTemplate_kind_idx" ON "AiTemplate"("kind");

-- CreateIndex: partial unique index, only one isDefault row per kind.
-- Prisma's schema DSL cannot express a partial index directly, the same
-- reason BlockerReason's name uniqueness is hand written too.
CREATE UNIQUE INDEX "AiTemplate_kind_default_idx"
  ON "AiTemplate" ("kind") WHERE "isDefault" = true;

-- AddForeignKey
ALTER TABLE "AiTemplate" ADD CONSTRAINT "AiTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
