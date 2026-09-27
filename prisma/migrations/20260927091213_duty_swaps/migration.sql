-- CreateTable
CREATE TABLE "DutySwap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requesterId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "requesterShiftId" TEXT NOT NULL,
    "partnerShiftId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "rejectReason" TEXT,
    "createdById" TEXT NOT NULL,
    "partnerRespondedAt" DATETIME,
    "requesterSideById" TEXT,
    "partnerSideById" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT,
    "decidedAt" DATETIME,
    CONSTRAINT "DutySwap_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DutySwap_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DutySwapDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "swapId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    CONSTRAINT "DutySwapDay_swapId_fkey" FOREIGN KEY ("swapId") REFERENCES "DutySwap" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DutySwap_status_idx" ON "DutySwap"("status");

-- CreateIndex
CREATE INDEX "DutySwapDay_date_idx" ON "DutySwapDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DutySwapDay_swapId_date_key" ON "DutySwapDay"("swapId", "date");
