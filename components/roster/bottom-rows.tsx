"use client";
import { ExtraChip, OpsChip } from "@/components/roster/chips";
import { cellKey, type Selection, type WorkspaceProps } from "@/components/roster/roster-workspace";
import { isWeekend } from "@/lib/dates";
import { ROW_EXTRA, ROW_OPS } from "@/lib/roster-types";
import { cn } from "@/lib/utils";

type Props = Pick<WorkspaceProps, "roster" | "mode" | "canEdit"> & {
  selection: Selection;
  onDate: (date: string) => void;
  onCell: (staffId: string, date: string, shiftKey: boolean) => void;
};

/**
 * Rows at the bottom of the roster, in the parade-state order (spec 5.3 to 5.5). Strength and Available
 * Slot(s) stay under the date header. Support and Recall are placeholders for now: no data, no logic.
 */
const ROWS = [
  { id: "support", label: "Support (AM/PM)", soon: true },
  { id: ROW_EXTRA, label: "Extra", soon: false },
  { id: "recall", label: "Recall", soon: true },
  { id: ROW_OPS, label: "Ops duty", soon: false },
] as const;

export function BottomRows({ roster, mode, canEdit, selection, onDate, onCell }: Props) {
  const editing = mode === "edit" && canEdit;
  return (
    <>
      {ROWS.map((row, i) => (
        <tr key={row.id}>
          <th
            title={row.soon ? "Not active yet" : undefined}
            className={cn(
              "sticky left-0 z-10 border-b border-r bg-background px-3 py-1 text-right align-middle text-[11px] font-bold uppercase tracking-wide",
              row.soon && "text-muted-foreground",
              i === 0 && "border-t-2",
            )}
          >
            {row.label}
          </th>
          {roster.dates.map((date) => {
            const interactive = editing && !row.soon;
            const selected = !row.soon && selection.cells.has(cellKey(row.id, date));
            const ops = row.id === ROW_OPS ? (roster.ops[date] ?? []) : [];
            const extra = row.id === ROW_EXTRA ? (roster.extra[date] ?? []) : [];
            return (
              <td
                key={date}
                onClick={interactive ? (e) => onCell(row.id, date, e.shiftKey) : () => onDate(date)}
                title={row.soon ? "Not active yet" : undefined}
                className={cn(
                  "h-10 select-none border-b border-r p-0.5 align-top",
                  i === 0 && "border-t-2",
                  row.soon ? "bg-muted/40" : isWeekend(date) && "bg-muted/30",
                  interactive && "cursor-pointer hover:bg-accent/60",
                  selected && "bg-primary/15 outline-2 -outline-offset-2 outline-primary",
                )}
              >
                {/* Several people can share a day: chips stack, so the row grows instead of clipping. */}
                <div className="flex flex-col items-center gap-0.5">
                  {ops.map((o) => (
                    <OpsChip key={o.dayworkerId} entry={o} />
                  ))}
                  {extra.map((e) => (
                    <ExtraChip key={e.staffId} entry={e} />
                  ))}
                </div>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
