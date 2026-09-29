"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { adjustOil, giveOilToShift } from "@/app/oil-actions";
import { leftLabel, remainingClass } from "@/components/requests/leave-taken";
import { ResultMessage, useAction } from "@/components/roster/use-action";
import { Button } from "@/components/ui/button";
import { leaveGroup } from "@/lib/domain";
import type { OilBalance } from "@/lib/leave-report";
import { formatFigure } from "@/lib/strength";
import { cn } from "@/lib/utils";

/** A leave type column: against an annual limit, against the person's OIL allowance, or a plain count. */
export type LeaveReportColumn = { key: string; label: string; kind: "limit" | "oil" | "count"; limit: number | null };

export type LeaveReportRow = {
  staffId: string;
  name: string;
  isSupervisor: boolean;
  /** Days taken this year, by column key. */
  taken: Record<string, number>;
  oil: OilBalance;
};

const STEP_BUTTON = "h-7 min-w-11 px-1.5 text-xs tabular-nums";
const CHIP = "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm transition-colors";

export function LeaveReportTable({ rows, columns, shiftId, canAward }: { rows: LeaveReportRow[]; columns: LeaveReportColumn[]; shiftId: string; canAward: boolean }) {
  const { pending, result, run } = useAction();
  const [confirmAll, setConfirmAll] = useState<number | null>(null);
  const [shown, setShown] = useState<Set<string>>(() => new Set(columns.map((c) => c.key)));
  const visible = columns.filter((c) => shown.has(c.key));
  const toggle = (key: string) =>
    setShown((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const showOnly = (pred: (c: LeaveReportColumn) => boolean) => setShown(new Set(columns.filter(pred).map((c) => c.key)));
  const head = "sticky top-0 z-10 border-b bg-muted px-3 py-2 font-semibold whitespace-nowrap";

  return (
    <div className="space-y-3">
      {canAward && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm">
          <span className="font-medium">Award OIL to everyone on Shift {shiftId}</span>
          {confirmAll === null ? (
            [1, 0.5].map((amount) => (
              <Button key={amount} size="sm" variant="outline" disabled={pending || rows.length === 0} onClick={() => setConfirmAll(amount)}>
                +{formatFigure(amount)} OIL to everyone
              </Button>
            ))
          ) : (
            <>
              <span className="text-muted-foreground">
                Give all active staff on Shift {shiftId} {formatFigure(confirmAll)} OIL? Each person is notified.
              </span>
              <Button size="sm" disabled={pending} onClick={() => run(() => giveOilToShift(shiftId, confirmAll), () => setConfirmAll(null))}>
                Yes, give {formatFigure(confirmAll)} OIL
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmAll(null)}>
                Cancel
              </Button>
            </>
          )}
        </div>
      )}
      <ResultMessage result={result} />

      {/* Which leave types become columns. Each chip carries its legend colour. */}
      <div className="space-y-2 rounded-xl border p-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="font-medium">Leave types</span>
          <span className="text-xs text-muted-foreground">
            {visible.length} of {columns.length} shown
          </span>
          <span className="ml-auto flex flex-wrap gap-1 text-xs">
            {(
              [
                ["All", () => true],
                ["With a limit", (c: LeaveReportColumn) => c.kind !== "count"],
                ["No limit", (c: LeaveReportColumn) => c.kind === "count"],
                ["Clear", () => false],
              ] as const
            ).map(([label, pred]) => (
              <button key={label} type="button" onClick={() => showOnly(pred)} className="rounded-md px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                {label}
              </button>
            ))}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Leave types to show">
          {columns.map((c) => {
            const on = shown.has(c.key);
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(c.key)}
                title={c.kind === "limit" ? `Limit ${c.limit} a year` : c.kind === "oil" ? "Against what each person is allowed" : "No limit"}
                className={cn(CHIP, on ? "border-primary/50 bg-primary/10 font-medium text-foreground" : "text-muted-foreground hover:bg-accent")}
              >
                <span data-leave={leaveGroup(c.key.split("/")[0])} className="size-2.5 shrink-0 rounded-full bg-(--chip)" aria-hidden />
                {c.label}
                {on && <Check className="size-3.5" aria-hidden />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative max-h-[70vh] overflow-auto rounded-xl border" role="region" aria-label="Leave report" tabIndex={0}>
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left">
              <th className={cn(head, "left-0 z-20 border-r")}>Staff</th>
              {visible.map((c) =>
                c.kind === "oil" ? (
                  <th key={c.key} className={cn(head, "border-x")} title="What supervisors have allowed, minus OIL already taken. Carries over from year to year.">
                    OIL they can take
                  </th>
                ) : (
                  <th key={c.key} className={cn(head, "text-right")} title={c.kind === "limit" ? `Limit ${c.limit} a year` : "No limit"}>
                    {c.label}
                    {c.kind === "limit" && <span className="font-normal text-muted-foreground"> / {c.limit}</span>}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.staffId} className="group align-middle">
                <th className="sticky left-0 z-10 border-r border-b bg-background px-3 py-2 text-left font-medium whitespace-nowrap group-hover:bg-accent">
                  {r.name}
                  {r.isSupervisor && <span className="ml-1 text-[11px] font-normal text-muted-foreground">Sup</span>}
                </th>
                {visible.map((c) => {
                  const taken = r.taken[c.key] ?? 0;
                  if (c.kind === "oil") return <OilCell key={c.key} row={r} canAward={canAward} pending={pending} onChange={(amount) => run(() => adjustOil(r.staffId, amount))} />;
                  if (c.kind === "count") {
                    return (
                      <td key={c.key} className="border-b px-3 py-2 text-right tabular-nums group-hover:bg-accent/40" title={`${r.name}, ${c.label}: ${formatFigure(taken)} taken`}>
                        <span className={cn(taken > 0 ? "font-medium" : "text-muted-foreground")}>{formatFigure(taken)}</span>
                        <span className="block text-[11px] text-muted-foreground">taken</span>
                      </td>
                    );
                  }
                  const left = c.limit! - taken;
                  return (
                    <td key={c.key} className="border-b px-3 py-2 text-right tabular-nums group-hover:bg-accent/40" title={`${r.name}, ${c.label}: ${leftLabel(left)}`}>
                      <span className={cn(taken > 0 ? "font-medium" : "text-muted-foreground")}>{formatFigure(taken)}</span>
                      <span className={cn("block text-[11px] font-semibold", remainingClass(left))}>{leftLabel(left)}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={visible.length + 1} className="px-3 py-6 text-center text-muted-foreground">
                  No staff on this shift.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {visible.length === 0 && rows.length > 0 && <p className="border-t px-3 py-4 text-center text-sm text-muted-foreground">Pick at least one leave type above to see it.</p>}
      </div>
      <p className="text-xs text-muted-foreground">
        Approved leave in the year shown. Limits are per year; types without one show a count. OIL is a running balance, not reset each year: awards add to it, approved
        OIL leave uses it, and the 0.5 OIL that comes with a DOS/FDO duty is separate. Each award or reduction is sent to the person as a notification.
      </p>
    </div>
  );
}

function OilCell({ row: r, canAward, pending, onChange }: { row: LeaveReportRow; canAward: boolean; pending: boolean; onChange: (amount: number) => void }) {
  return (
    <td className="border-x border-b px-3 py-2 group-hover:bg-accent/40">
      <div className="flex items-center gap-3">
        <div className="min-w-24">
          <span className={cn("text-base font-semibold tabular-nums", remainingClass(r.oil.left))}>{formatFigure(r.oil.left)}</span>
          <span className="block text-[11px] text-muted-foreground tabular-nums">
            used {formatFigure(r.oil.used)} of {formatFigure(r.oil.allowed)}
          </span>
        </div>
        {canAward && (
          <div className="flex gap-1" role="group" aria-label={`Change ${r.name}'s OIL`}>
            <Button size="sm" variant="outline" className={STEP_BUTTON} disabled={pending || r.oil.allowed < 0.5} aria-label={`Take 0.5 OIL back from ${r.name}`} title="Take back 0.5 OIL" onClick={() => onChange(-0.5)}>
              −0.5
            </Button>
            <Button size="sm" variant="outline" className={STEP_BUTTON} disabled={pending} aria-label={`Award 0.5 OIL to ${r.name}`} title="Award 0.5 OIL" onClick={() => onChange(0.5)}>
              +0.5
            </Button>
            <Button size="sm" variant="outline" className={STEP_BUTTON} disabled={pending} aria-label={`Award 1 OIL to ${r.name}`} title="Award 1 OIL" onClick={() => onChange(1)}>
              +1
            </Button>
          </div>
        )}
      </div>
    </td>
  );
}
