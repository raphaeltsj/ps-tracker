import Link from "next/link";
import { notFound } from "next/navigation";
import { LeaveReportTable, type LeaveReportColumn, type LeaveReportRow } from "@/components/reports/leave-report-table";
import { requireViewer } from "@/lib/auth";
import { todayLocal } from "@/lib/dates";
import { db } from "@/lib/db";
import { baseLeaveCode } from "@/lib/domain";
import { leaveTakenRows, tallyLeaveTaken } from "@/lib/leave-report";
import { getOilBalances } from "@/lib/oil";
import { canEditShift, canViewLeaveReport } from "@/lib/permissions";
import { buildRoster } from "@/lib/roster-data";
import { cn } from "@/lib/utils";

export const metadata = { title: "Leave report | PS Tracker" };

const SHIFTS = ["A", "B", "C"];
const KIND_ORDER: Record<LeaveReportColumn["kind"], number> = { limit: 0, oil: 1, count: 2 };

/**
 * Leave each person has taken in a year: every type, against its limit where it has one (AL/OL, MC, OML,
 * BD/BD-IL, GRW), the OIL they're allowed (awarded here), and a count for the rest. Counts come from the
 * roster, so they match My Requests.
 */
export default async function LeaveReportPage({ searchParams }: PageProps<"/leave-report">) {
  const viewer = await requireViewer();
  if (!canViewLeaveReport(viewer)) notFound();

  const params = await searchParams;
  const param = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const thisYear = Number(todayLocal().slice(0, 4));
  const years = [thisYear - 2, thisYear - 1, thisYear, thisYear + 1];
  const year = years.includes(Number(param("year"))) ? Number(param("year")) : thisYear;
  const shiftId = viewer.role === "SUPERVISOR" ? viewer.shiftId! : SHIFTS.includes(param("shift")) ? param("shift") : "A";

  const [roster, leaveTypes] = await Promise.all([
    buildRoster(shiftId, `${year}-01-01`, `${year}-12-31`, viewer),
    db.leaveType.findMany({ orderBy: [{ custom: "asc" }, { sortOrder: "asc" }] }),
  ]);
  const staff = roster.staff.filter((s) => s.role !== "MANAGEMENT");
  const oil = await getOilBalances(staff.map((s) => s.id));
  const baseCodes = [...new Set(leaveTypes.map((t) => baseLeaveCode(t.code)))];

  // One column per leave type (limit groups first, then OIL, then every type with no limit, custom types
  // included), even at zero, the same rows My Requests shows.
  const columns: LeaveReportColumn[] = leaveTakenRows([], [], baseCodes).map((r) => ({
    key: r.key,
    label: r.label,
    kind: r.limit !== null ? "limit" : r.key === "OIL" ? "oil" : "count",
    limit: r.limit,
  }));
  columns.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);

  const rows: LeaveReportRow[] = staff.map((s) => {
    const { byType } = tallyLeaveTaken(roster.cells[s.id], roster.dates);
    return {
      staffId: s.id,
      name: s.name,
      isSupervisor: s.role === "SUPERVISOR",
      taken: Object.fromEntries(leaveTakenRows(byType, byType, baseCodes).map((r) => [r.key, r.annualCount])),
      oil: oil[s.id],
    };
  });

  const tab = (active: boolean) => cn("rounded-md px-2.5 py-1", active ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground hover:bg-accent");
  const href = (next: { year?: number; shift?: string }) => `/leave-report?year=${next.year ?? year}${viewer.role === "MANAGEMENT" ? `&shift=${next.shift ?? shiftId}` : ""}`;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4 pb-24 lg:pb-6">
      <div>
        <h1 className="text-xl font-semibold">Leave report</h1>
        <p className="text-sm text-muted-foreground">
          Every type of leave taken in {year}: against its limit where it has one, OIL against what each person is allowed, and a count for the rest. Approved leave
          only, like My Requests.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {viewer.role === "MANAGEMENT" && (
          <div className="flex h-8 items-center gap-0.5 rounded-lg border p-0.5 text-sm" role="tablist" aria-label="Shift">
            {SHIFTS.map((id) => (
              <Link key={id} href={href({ shift: id })} role="tab" aria-selected={shiftId === id} className={tab(shiftId === id)}>
                Shift {id}
              </Link>
            ))}
          </div>
        )}
        <div className="flex h-8 items-center gap-0.5 rounded-lg border p-0.5 text-sm" role="tablist" aria-label="Year">
          {years.map((y) => (
            <Link key={y} href={href({ year: y })} role="tab" aria-selected={year === y} className={tab(year === y)}>
              {y}
            </Link>
          ))}
        </div>
      </div>

      <LeaveReportTable rows={rows} columns={columns} shiftId={shiftId} canAward={canEditShift(viewer, shiftId)} />
    </main>
  );
}
