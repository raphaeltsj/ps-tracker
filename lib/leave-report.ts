// "Leave taken" stats for the My Requests page: how many days of each leave type a person has taken
// (approved only), for a month or a year. Pure tally over roster cells, so it agrees with everything
// else the roster shows (including derived BD / BD-IL and half-day counts).
import { baseLeaveCode } from "@/lib/domain";
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

export type LeaveLimitGroup = { key: string; label: string; codes: string[]; limit: number };

/** Leave types tracked together against a combined annual limit. Everything else has no limit. */
export const LEAVE_LIMIT_GROUPS: LeaveLimitGroup[] = [
  { key: "AL", label: "AL/OL", codes: ["AL", "OL"], limit: 18 },
  { key: "MC", label: "MC", codes: ["MC"], limit: 14 },
  { key: "OML", label: "OML", codes: ["OML"], limit: 3 },
  { key: "BD", label: "BD/BD-IL", codes: ["BD", "BD-IL"], limit: 1 },
  // GRW and 0.5 GRW fold together (baseLeaveCode), so half days count toward the 7.
  { key: "GRW", label: "GRW", codes: ["GRW"], limit: 7 },
];

/**
 * OIL someone may take: `allowed` is what supervisors have awarded, `used` their approved OIL leave, as
 * a running balance (not per year). Loaded by lib/oil.ts.
 */
export type OilBalance = { allowed: number; used: number; left: number };

export type LeaveTakenRow = {
  key: string;
  label: string;
  /** Taken in the selected period (month or year). */
  count: number;
  /** Taken this year, regardless of the selected period: what a limit is checked against. */
  annualCount: number;
  limit: number | null;
  /** OIL only: the person's own allowance, which replaces a fixed limit. */
  oil?: OilBalance;
};

/**
 * Every leave type the shift has, as one row per limit group (AL/OL, MC, OML, BD/BD-IL, GRW) plus one row
 * for everything else (its own base code, no limit, tracked as before). `allCodes` is every base code
 * in use (half/full-day variants already folded together by `baseLeaveCode`), so a type with nothing
 * taken still shows at zero. With `oil`, the OIL row carries the person's own allowance.
 */
export function leaveTakenRows(byType: LeaveTally[], annualByType: LeaveTally[], allCodes: string[], oil?: OilBalance): LeaveTakenRow[] {
  const codeSet = new Set(allCodes);
  const grouped = new Set(LEAVE_LIMIT_GROUPS.flatMap((g) => g.codes));
  const sumFor = (list: LeaveTally[], code: string) => list.filter((b) => baseLeaveCode(b.code) === code).reduce((sum, b) => sum + b.count, 0);

  const rows: LeaveTakenRow[] = LEAVE_LIMIT_GROUPS.map((g) => {
    const codes = g.codes.filter((c) => codeSet.has(c));
    return {
      key: g.key,
      label: g.label,
      limit: g.limit,
      count: codes.reduce((sum, c) => sum + sumFor(byType, c), 0),
      annualCount: codes.reduce((sum, c) => sum + sumFor(annualByType, c), 0),
    };
  });
  for (const code of allCodes) {
    if (grouped.has(code)) continue;
    rows.push({ key: code, label: code, limit: null, count: sumFor(byType, code), annualCount: sumFor(annualByType, code), ...(code === "OIL" && oil ? { oil } : {}) });
  }
  return rows;
}
