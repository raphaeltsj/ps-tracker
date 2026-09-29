import type { LeaveTakenRow } from "@/lib/leave-report";
import { formatFigure } from "@/lib/strength";
import { cn } from "@/lib/utils";

/** Same colour bands as the roster's Available Slot(s): green above 2 left, amber at 1-2, red at or
 * below 0 (over the limit, e.g. leave given beyond it). Shared with the Leave report. */
export function remainingClass(remaining: number): string {
  if (remaining <= 0) return "text-danger-ink";
  if (remaining <= 2) return "text-warning-ink";
  return "text-success-ink";
}

export function barClass(remaining: number): string {
  if (remaining <= 0) return "bg-danger";
  if (remaining <= 2) return "bg-warning";
  return "bg-success";
}

export function leftLabel(remaining: number): string {
  return remaining < 0 ? `${formatFigure(Math.abs(remaining))} over` : `${formatFigure(remaining)} left`;
}

/** What a row is measured against: a fixed annual limit, or (OIL) what supervisors have allowed. */
function measure(r: LeaveTakenRow): { used: number; cap: number } | null {
  if (r.limit !== null) return { used: r.annualCount, cap: r.limit };
  if (r.oil) return { used: r.oil.used, cap: r.oil.allowed };
  return null;
}

/** Leave taken as a list: a limited row shows a progress bar and how many are left (annual limits are
 * checked against the year whichever period is selected; OIL against what supervisors have allowed);
 * an unlimited type just shows the count. */
export function LeaveTaken({ rows, total, periodLabel }: { rows: LeaveTakenRow[]; total: number; periodLabel: string }) {
  return (
    <div className="space-y-2">
      <ul className="divide-y rounded-lg border text-sm">
        {rows.map((r) => {
          const m = measure(r);
          const remaining = m ? m.cap - m.used : null;
          return (
            <li key={r.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2" title={r.oil ? "OIL allowed by your supervisor. It carries over: it isn't reset each year." : undefined}>
              <span className="w-16 shrink-0 truncate font-medium" title={r.label}>
                {r.label}
              </span>
              {m === null ? (
                <span className="text-muted-foreground">{formatFigure(r.count)} taken</span>
              ) : (
                <>
                  <span className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className={cn("block h-full rounded-full", barClass(remaining!))} style={{ width: `${m.cap > 0 ? Math.min(100, Math.max(0, (m.used / m.cap) * 100)) : 0}%` }} />
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatFigure(m.used)}/{formatFigure(m.cap)}
                  </span>
                  <span className={cn("ml-auto shrink-0 text-xs font-semibold tabular-nums", remainingClass(remaining!))}>{leftLabel(remaining!)}</span>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        {formatFigure(total)} day{total === 1 ? "" : "s"} total, {periodLabel}. Limits (AL/OL, MC, OML, BD/BD-IL, GRW) are checked against the year, whichever period is shown
        above. OIL is what your supervisor has allowed you, and carries over; the 0.5 OIL that comes with a DOS/FDO duty is separate.
      </p>
    </div>
  );
}
