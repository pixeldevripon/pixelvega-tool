-- CreateTable
CREATE TABLE "MeetingTimeEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" "TimeEntryStatus" NOT NULL DEFAULT 'RUNNING',
    "notes" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingTimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingTimeEntry_userId_idx" ON "MeetingTimeEntry"("userId");

-- CreateIndex
CREATE INDEX "MeetingTimeEntry_userId_status_idx" ON "MeetingTimeEntry"("userId", "status");

-- CreateIndex
CREATE INDEX "MeetingTimeEntry_sessionId_idx" ON "MeetingTimeEntry"("sessionId");

-- AddForeignKey
ALTER TABLE "MeetingTimeEntry" ADD CONSTRAINT "MeetingTimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
