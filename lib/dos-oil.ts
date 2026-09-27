import "server-only";
import { addDays, formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { DOS_OIL_CODE, DOS_OIL_HALF } from "@/lib/domain";

/** The automatic 0.5 OIL (first half) the day after a DOS/FDO duty on a 1st AM (spec 5.2). */
export async function createDosOil(duty: { id: string; staffId: string; date: string; kind: string }, byId: string) {
  await db.leave.create({
    data: {
      staffId: duty.staffId,
      typeCode: DOS_OIL_CODE,
      half: DOS_OIL_HALF,
      status: "APPROVED",
      remarks: `Automatic after ${duty.kind} duty on ${formatDate(duty.date)}.`,
      givenById: byId,
      decidedById: byId,
      decidedAt: new Date(),
      autoFor: duty.id,
      days: { create: [{ date: addDays(duty.date, 1) }] },
    },
  });
}
