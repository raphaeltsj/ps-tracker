import "server-only";
import { db } from "@/lib/db";
import type { DayworkerReportRow } from "@/lib/dayworkers";

/**
 * How many days each dayworker clocked shift duty (Ops duty) in [from, to], and on which shifts.
 * Every dayworker is listed, including inactive ones, so the history stays visible.
 */
export async function getDayworkerReport(from: string, to: string): Promise<DayworkerReportRow[]> {
  const [dayworkers, duties] = await Promise.all([
    db.dayworker.findMany({ orderBy: [{ active: "desc" }, { username: "asc" }] }),
    from <= to
      ? db.opsDuty.findMany({ where: { date: { gte: from, lte: to } }, orderBy: { date: "asc" } })
      : Promise.resolve([]),
  ]);

  const rows = new Map<string, DayworkerReportRow>(
    dayworkers.map((d) => [d.id, { id: d.id, name: d.name, username: d.username, active: d.active, total: 0, byShift: {}, days: [] }]),
  );
  for (const duty of duties) {
    const row = rows.get(duty.dayworkerId);
    if (!row) continue;
    row.total++;
    row.byShift[duty.shiftId] = (row.byShift[duty.shiftId] ?? 0) + 1;
    row.days.push({ date: duty.date, shiftId: duty.shiftId });
  }
  return [...rows.values()];
}

/** Years that have any Ops duty, plus the current year. */
export async function dayworkerReportYears(currentYear: number): Promise<number[]> {
  const [first, last] = await Promise.all([
    db.opsDuty.findFirst({ orderBy: { date: "asc" }, select: { date: true } }),
    db.opsDuty.findFirst({ orderBy: { date: "desc" }, select: { date: true } }),
  ]);
  const lo = Math.min(currentYear, first ? Number(first.date.slice(0, 4)) : currentYear);
  const hi = Math.max(currentYear, last ? Number(last.date.slice(0, 4)) : currentYear);
  return Array.from({ length: hi - lo + 1 }, (_, i) => hi - i);
}
