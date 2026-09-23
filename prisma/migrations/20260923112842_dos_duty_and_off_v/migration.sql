/*
  Warnings:

  - You are about to drop the `VHeadcount` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Leave" ADD COLUMN "autoFor" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "VHeadcount";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "ExtraDuty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    CONSTRAINT "ExtraDuty_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ExtraDuty_staffId_date_key" ON "ExtraDuty"("staffId", "date");
