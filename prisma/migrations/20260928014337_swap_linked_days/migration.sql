-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DutySwapDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "swapId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "linked" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "DutySwapDay_swapId_fkey" FOREIGN KEY ("swapId") REFERENCES "DutySwap" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DutySwapDay" ("date", "id", "swapId") SELECT "date", "id", "swapId" FROM "DutySwapDay";
DROP TABLE "DutySwapDay";
ALTER TABLE "new_DutySwapDay" RENAME TO "DutySwapDay";
CREATE INDEX "DutySwapDay_date_idx" ON "DutySwapDay"("date");
CREATE UNIQUE INDEX "DutySwapDay_swapId_date_key" ON "DutySwapDay"("swapId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
