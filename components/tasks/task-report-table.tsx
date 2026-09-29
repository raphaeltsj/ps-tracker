import { TaskTag } from "@/components/roster/chips";
import type { TaskReport, TaskReportRow } from "@/lib/task-report";
import { cn } from "@/lib/utils";

/**
 * Staff x Task counts with per-Task totals.
 * Built to stay readable with many Tasks and many staff: the table scrolls inside its own frame
 * with the header row, the Staff column and the Total column pinned.
 */
export function TaskReportTable({ report, hideEmpty, showShift }: { report: TaskReport; hideEmpty: boolean; showShift: boolean }) {
  const rows = hideEmpty ? report.rows.filter((r) => r.total > 0) : report.rows;

  if (report.tasks.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        No Tasks were done in this period. Tick &quot;Show Tasks nobody did&quot; to list them anyway.
      </p>
    );
  }

  // Busiest Tasks first in the summary strip.
  const byUse = [...report.tasks].sort((a, b) => (report.taskTotals[b.id] ?? 0) - (report.taskTotals[a.id] ?? 0));
  const pinned = "sticky z-10 bg-background";
  const head = "sticky top-0 z-20 bg-muted";

  return (
    <div className="space-y-4">
      {/* Summary per Task: a horizontal strip so it never grows taller with more Tasks */}
      <ul className="relative flex gap-2 overflow-x-auto pb-1" aria-label="Days per Task" tabIndex={0}>
        <li className="min-w-32 shrink-0 rounded-lg border bg-muted/50 p-3">
          <span className="text-xs font-medium">All Tasks</span>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{report.total}</div>
          <div className="text-xs text-muted-foreground">days in total</div>
        </li>
        {byUse.map((t) => (
          <li key={t.id} className="min-w-28 shrink-0 rounded-lg border p-3">
            <TaskTag name={t.name} className="h-5 text-xs" />
            <div className="mt-1 text-2xl font-semibold tabular-nums">{report.taskTotals[t.id] ?? 0}</div>
            <div className="text-xs text-muted-foreground">days, {report.taskPeople[t.id] ?? 0} people</div>
          </li>
        ))}
      </ul>

      <div className="relative max-h-[65vh] overflow-auto rounded-xl border">
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left">
              <th className={cn(head, "left-0 z-30 min-w-36 border-b border-r px-3 py-2 font-semibold")}>Staff</th>
              {showShift && <th className={cn(head, "border-b px-3 py-2 font-semibold")}>Shift</th>}
              {report.tasks.map((t) => (
                <th key={t.id} className={cn(head, "min-w-16 border-b px-2 py-2 text-right font-semibold whitespace-nowrap")}>
                  {t.name}
                </th>
              ))}
              <th className={cn(head, "right-0 z-30 border-b border-l px-3 py-2 text-right font-semibold")}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.staffId} className="group align-top">
                <td className={cn(pinned, "left-0 border-b border-r px-3 py-2 group-hover:bg-accent")}>
                  <StaffCell row={r} />
                </td>
                {showShift && <td className="border-b px-3 py-2 text-muted-foreground group-hover:bg-accent/40">{r.shiftId}</td>}
                {report.tasks.map((t) => (
                  <td
                    key={t.id}
                    className={cn("border-b px-2 py-2 text-right tabular-nums group-hover:bg-accent/40", !r.counts[t.id] && "text-muted-foreground/50")}
                    title={`${r.name}, ${t.name}: ${r.counts[t.id] ?? 0} day(s)`}
                  >
                    {r.counts[t.id] ?? "–"}
                  </td>
                ))}
                <td className={cn(pinned, "right-0 border-b border-l px-3 py-2 text-right font-semibold tabular-nums group-hover:bg-accent")}>{r.total}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={report.tasks.length + (showShift ? 3 : 2)} className="px-3 py-6 text-center text-muted-foreground">
                  No Tasks in this period.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="font-semibold">
                <td className="sticky bottom-0 left-0 z-30 border-r border-t bg-muted px-3 py-2">Total</td>
                {showShift && <td className="sticky bottom-0 z-20 border-t bg-muted" />}
                {report.tasks.map((t) => (
                  <td key={t.id} className="sticky bottom-0 z-20 border-t bg-muted px-2 py-2 text-right tabular-nums">
                    {report.taskTotals[t.id] ?? 0}
                  </td>
                ))}
                <td className="sticky bottom-0 right-0 z-30 border-l border-t bg-muted px-3 py-2 text-right tabular-nums">{report.total}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {report.tasks.length > 8 && (
        <p className="text-xs text-muted-foreground">Scroll sideways for more Tasks. Use the Tasks filter to narrow the columns.</p>
      )}
    </div>
  );
}

// Name only: which dates someone did a Task is on the roster, and a per-person list would get long.
function StaffCell({ row }: { row: TaskReportRow }) {
  return (
    <span className="font-medium whitespace-nowrap">
      {row.name}
      {row.role === "SUPERVISOR" && <span className="ml-1 text-[11px] font-normal text-muted-foreground">Sup</span>}
    </span>
  );
}
