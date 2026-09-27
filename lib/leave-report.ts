// "Leave taken" stats for the My Requests page: how many days of each leave type a person has taken
// (approved only), for a month or a year. Pure tally over roster cells, so it agrees with everything
// else the roster shows (including derived BD / BD-IL and half-day counts).
import type { RosterCell } from "@/lib/roster-types";
import { isLeaveEntry } from "@/lib/roster-types";

export type LeaveTally = { code: string; count: number };

/** Sums approved leave, by type code, across `dates` for one person's cells. Half-day counts 0.5. */
export function tallyLeaveTaken(cells: Record<string, RosterCell>, dates: string[]): { total: number; byType: LeaveTally[] } {
  const byCode = new Map<string, number>();
  for (const date of dates) {
    for (const a of cells[date]?.absences ?? []) {
      if (a.status !== "APPROVED" || !isLeaveEntry(a)) continue;
      byCode.set(a.code, (byCode.get(a.code) ?? 0) + a.counts);
    }
  }
  const byType = [...byCode.entries()].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
  return { total: byType.reduce((sum, t) => sum + t.count, 0), byType };
}
