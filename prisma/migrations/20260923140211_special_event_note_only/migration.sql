/*
  Warnings:

  - You are about to drop the column `reportTime` on the `SpecialEvent` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SpecialEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shiftId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "note" TEXT,
    CONSTRAINT "SpecialEvent_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SpecialEvent" ("date", "id", "note", "shiftId") SELECT "date", "id", "note", "shiftId" FROM "SpecialEvent";
DROP TABLE "SpecialEvent";
ALTER TABLE "new_SpecialEvent" RENAME TO "SpecialEvent";
CREATE UNIQUE INDEX "SpecialEvent_shiftId_date_key" ON "SpecialEvent"("shiftId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
