import type { LeaveTakenRow } from "@/lib/leave-report";
import { formatFigure } from "@/lib/strength";
import { cn } from "@/lib/utils";

/** Same colour bands as the roster's Available Slot(s): green above 2 left, amber at 1-2, red at or
 * below 0 (over the limit, e.g. leave given beyond it). */
function remainingClass(remaining: number): string {
  if (remaining <= 0) return "text-red-700 dark:text-red-300";
  if (remaining <= 2) return "text-amber-700 dark:text-amber-300";
  return "text-emerald-700 dark:text-emerald-300";
}

function barClass(remaining: number): string {
  if (remaining <= 0) return "bg-red-600";
  if (remaining <= 2) return "bg-amber-500";
  return "bg-emerald-600";
}

/** Leave taken as a list: a combined-limit row shows a progress bar and how many are left this year
 * (always annual, whichever period is selected above); an unlimited type just shows the count. */
export function LeaveTaken({ rows, total, periodLabel }: { rows: LeaveTakenRow[]; total: number; periodLabel: string }) {
  return (
    <div className="space-y-2">
      <ul className="divide-y rounded-lg border text-sm">
        {rows.map((r) => {
          const remaining = r.limit === null ? null : r.limit - r.annualCount;
          return (
            <li key={r.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <span className="w-16 shrink-0 truncate font-medium" title={r.label}>
                {r.label}
              </span>
              {r.limit === null ? (
                <span className="text-muted-foreground">{formatFigure(r.count)} taken</span>
              ) : (
                <>
                  <span className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className={cn("block h-full rounded-full", barClass(remaining!))} style={{ width: `${Math.min(100, Math.max(0, (r.annualCount / r.limit) * 100))}%` }} />
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatFigure(r.annualCount)}/{r.limit}
                  </span>
                  <span className={cn("ml-auto shrink-0 text-xs font-semibold tabular-nums", remainingClass(remaining!))}>
                    {remaining! < 0 ? `${formatFigure(Math.abs(remaining!))} over` : `${formatFigure(remaining!)} left`}
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        {formatFigure(total)} day{total === 1 ? "" : "s"} total, {periodLabel}. Limits (AL/OL, MC, OML, BD/BD-IL) are checked against the year, whichever period is shown above.
      </p>
    </div>
  );
}
