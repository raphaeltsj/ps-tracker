-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "cycleAnchor" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "shiftId" TEXT,
    "birthday" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Staff_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "token" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DutyOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "duty" TEXT NOT NULL,
    CONSTRAINT "DutyOverride_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeaveType" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "halfDay" BOOLEAN NOT NULL DEFAULT false,
    "custom" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Leave" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "typeCode" TEXT NOT NULL,
    "half" TEXT,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "remarks" TEXT,
    "rejectReason" TEXT,
    "givenById" TEXT,
    "decidedById" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" DATETIME,
    CONSTRAINT "Leave_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Leave_typeCode_fkey" FOREIGN KEY ("typeCode") REFERENCES "LeaveType" ("code") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Leave_givenById_fkey" FOREIGN KEY ("givenById") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Leave_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeaveDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leaveId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    CONSTRAINT "LeaveDay_leaveId_fkey" FOREIGN KEY ("leaveId") REFERENCES "Leave" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TaskAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    CONSTRAINT "TaskAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LockedDate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shiftId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "remarks" TEXT NOT NULL,
    CONSTRAINT "LockedDate_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SpecialEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shiftId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "reportTime" TEXT NOT NULL,
    "note" TEXT,
    CONSTRAINT "SpecialEvent_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VHeadcount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shiftId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    CONSTRAINT "VHeadcount_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DutyOverride_staffId_date_key" ON "DutyOverride"("staffId", "date");

-- CreateIndex
CREATE INDEX "LeaveDay_date_idx" ON "LeaveDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveDay_leaveId_date_key" ON "LeaveDay"("leaveId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TaskAssignment_staffId_date_key" ON "TaskAssignment"("staffId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "LockedDate_shiftId_date_key" ON "LockedDate"("shiftId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialEvent_shiftId_date_key" ON "SpecialEvent"("shiftId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "VHeadcount_shiftId_date_key" ON "VHeadcount"("shiftId", "date");
