import "server-only";
import { db } from "@/lib/db";
import { buildRoster } from "@/lib/roster-data";

export type LeaveConflict = { date: string; code: string; status: string };

/**
 * A person can hold only one type of leave per day (pending or approved), including the derived
 * BD / BD-IL. Returns the first clashing date, or null.
 */
export async function findLeaveConflict(staffId: string, dates: string[], excludeLeaveId?: string): Promise<LeaveConflict | null> {
  if (dates.length === 0) return null;
  const sorted = [...dates].sort();

  const clash = await db.leaveDay.findFirst({
    where: {
      date: { in: sorted },
      leave: { staffId, status: { in: ["PENDING", "APPROVED"] }, id: excludeLeaveId ? { not: excludeLeaveId } : undefined },
    },
    include: { leave: true },
    orderBy: { date: "asc" },
  });
  if (clash) return { date: clash.date, code: clash.leave.typeCode, status: clash.leave.status };

  const staff = await db.staff.findUnique({ where: { id: staffId } });
  if (!staff?.shiftId || !staff.birthday) return null;
  // Only this person's cells are needed (BD / BD-IL), not the whole shift.
  const roster = await buildRoster(staff.shiftId, sorted[0], sorted[sorted.length - 1], null, { staffIds: [staffId] });
  for (const date of sorted) {
    const derived = roster.cells[staffId]?.[date]?.absences.find((a) => a.derived && a.counts > 0);
    if (derived) return { date, code: derived.code, status: "APPROVED" };
  }
  return null;
}
