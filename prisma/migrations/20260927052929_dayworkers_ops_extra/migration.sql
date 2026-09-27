-- CreateTable
CREATE TABLE "Dayworker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "OpsDuty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dayworkerId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    CONSTRAINT "OpsDuty_dayworkerId_fkey" FOREIGN KEY ("dayworkerId") REFERENCES "Dayworker" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OpsDuty_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExtraShiftDuty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "hostShiftId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    CONSTRAINT "ExtraShiftDuty_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExtraShiftDuty_hostShiftId_fkey" FOREIGN KEY ("hostShiftId") REFERENCES "Shift" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Dayworker_username_key" ON "Dayworker"("username");

-- CreateIndex
CREATE INDEX "OpsDuty_shiftId_date_idx" ON "OpsDuty"("shiftId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "OpsDuty_dayworkerId_date_key" ON "OpsDuty"("dayworkerId", "date");

-- CreateIndex
CREATE INDEX "ExtraShiftDuty_hostShiftId_date_idx" ON "ExtraShiftDuty"("hostShiftId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ExtraShiftDuty_staffId_date_key" ON "ExtraShiftDuty"("staffId", "date");
