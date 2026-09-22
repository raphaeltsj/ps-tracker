"use client";
import { memo } from "react";
import { CalendarClock, Lock } from "lucide-react";
import { DutyChip, LeaveChip, SLOT_BG, SLOT_STYLE, TaskTag } from "@/components/roster/chips";
import { cellKey, type Selection, type WorkspaceProps } from "@/components/roster/roster-workspace";
import { isWeekend, weekdayShort } from "@/lib/dates";
import type { RosterCell, RosterDay } from "@/lib/roster-types";
import { formatFigure } from "@/lib/strength";
import { cn } from "@/lib/utils";

type GridProps = WorkspaceProps & {
  selection: Selection;
  compact: boolean;
  onDate: (date: string, shiftKey: boolean) => void;
  onCell: (staffId: string, date: string, shiftKey: boolean) => void;
  onLeave: (leaveId: string | null, date: string) => void;
};

const SHIFT_DUTY_LABEL = { AM: "AM", PM: "PM", OFF: "Rest" } as const;

/** Desktop month grid: sticky name column, sticky date header with strength rows directly below. */
export function RosterGrid({ roster, selection, compact, today, viewer, mode, onDate, onCell, onLeave }: GridProps) {
  const { dates, days } = roster;

  const strengthRows: { label: string; value: (d: RosterDay) => React.ReactNode; cls?: (d: RosterDay) => string }[] = [
    { label: "Total Strength", value: (d) => d.strength.total },
    { label: "Not in Strength", value: (d) => formatFigure(d.strength.notIn) },
    { label: "Working Strength", value: (d) => formatFigure(d.strength.working) },
    { label: "MFL", value: (d) => (d.strength.mfl === null ? <span className="text-muted-foreground">–</span> : d.strength.mfl) },
  ];

  return (
    <div className="h-full overflow-auto">
      <table className="border-separate border-spacing-0 text-xs">
        <thead className="sticky top-0 z-20 bg-background">
          <tr>
            <th className="sticky left-0 z-30 min-w-40 border-b border-r bg-background px-3 py-1.5 text-left font-semibold">
              {roster.shiftName}
              <span className="block font-normal text-muted-foreground">{roster.staff.length} staff</span>
            </th>
            {dates.map((date) => {
              const day = days[date];
              const selected = selection.dates.has(date) || selection.focusDate === date;
              return (
                <th
                  key={date}
                  onClick={(e) => onDate(date, e.shiftKey)}
                  title={day.locked ? `Locked date: ${day.locked}` : day.event ? `Special Event: report at ${day.event.reportTime}` : undefined}
                  className={cn(
                    "min-w-14 cursor-pointer select-none border-b border-r px-1 py-1 text-center font-normal",
                    isWeekend(date) && "bg-muted/60",
                    day.locked && "bg-hatch",
                    day.event && "border-t-2 border-t-fuchsia-500",
                    selected && "ring-2 ring-inset ring-primary",
                  )}
                >
                  <div className={cn("text-[10px] uppercase text-muted-foreground", date === today && "font-bold text-foreground")}>{weekdayShort(date)}</div>
                  <div className={cn("text-sm font-semibold", date === today && "mx-auto w-fit rounded-full bg-primary px-1.5 text-primary-foreground")}>
                    {Number(date.slice(8))}
                  </div>
                  <div className="flex items-center justify-center gap-0.5 text-[10px] text-muted-foreground">
                    {SHIFT_DUTY_LABEL[day.shiftDuty]}
                    {day.locked && <Lock className="size-3 text-foreground" aria-label="Locked date" />}
                    {day.event && <CalendarClock className="size-3 text-fuchsia-600 dark:text-fuchsia-400" aria-label={`Special Event: report at ${day.event.reportTime}`} />}
                  </div>
                </th>
              );
            })}
          </tr>
          {!compact &&
            strengthRows.map((row) => (
              <tr key={row.label}>
                <th className="sticky left-0 z-30 border-b border-r bg-background px-3 py-0.5 text-left font-medium text-muted-foreground">{row.label}</th>
                {dates.map((date) => (
                  <td key={date} className="border-b border-r bg-background px-1 py-0.5 text-center tabular-nums">
                    {row.value(days[date])}
                  </td>
                ))}
              </tr>
            ))}
          <tr>
            <th className="sticky left-0 z-30 border-b-2 border-r bg-background px-3 py-0.5 text-left font-semibold">Available Slot(s)</th>
            {dates.map((date) => {
              const s = days[date].strength;
              return (
                <td key={date} className={cn("border-b-2 border-r px-1 py-0.5 text-center tabular-nums", SLOT_BG[s.status], SLOT_STYLE[s.status])} title={s.status === "below" ? "Below MFL" : undefined}>
                  {s.status === "zero" ? "No slots" : s.status === "below" ? `⚠ ${formatFigure(s.slots)}` : formatFigure(s.slots)}
                </td>
              );
            })}
          </tr>
          {!compact && (
            <tr>
              <th className="sticky left-0 z-30 border-b-2 border-r bg-background px-3 py-0.5 text-left font-medium text-muted-foreground">V on duty / MFL</th>
              {dates.map((date) => {
                const v = days[date].v;
                const short = v && v.onDuty < v.mfl;
                return (
                  <td key={date} className={cn("border-b-2 border-r bg-background px-1 py-0.5 text-center tabular-nums", short && "bg-red-100 font-bold text-red-700 dark:bg-red-500/20 dark:text-red-300")}>
                    {v ? `${v.onDuty}/${v.mfl}` : <span className="text-muted-foreground">–</span>}
                  </td>
                );
              })}
            </tr>
          )}
        </thead>
        <tbody>
          {roster.staff.map((person) => (
            <tr key={person.id} className={cn(person.id === viewer.id && "bg-primary/5")}>
              <th className={cn("sticky left-0 z-10 border-b border-r bg-background px-3 py-1 text-left font-medium", person.id === viewer.id && "bg-accent")}>
                <span className="flex items-center gap-1.5">
                  {person.name}
                  {person.role === "SUPERVISOR" && <span className="rounded bg-muted px-1 text-[10px] font-semibold text-muted-foreground">Sup</span>}
                  {person.id === viewer.id && <span className="text-[10px] text-muted-foreground">(you)</span>}
                </span>
              </th>
              {dates.map((date) => (
                <GridCell
                  key={date}
                  cell={roster.cells[person.id][date]}
                  day={days[date]}
                  selected={mode === "edit" ? selection.cells.has(cellKey(person.id, date)) : person.id === viewer.id && selection.dates.has(date)}
                  onClick={(shiftKey) => onCell(person.id, date, shiftKey)}
                  onLeave={(leaveId) => onLeave(leaveId, date)}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const GridCell = memo(function GridCell({
  cell,
  day,
  selected,
  onClick,
  onLeave,
}: {
  cell: RosterCell;
  day: RosterDay;
  selected: boolean;
  onClick: (shiftKey: boolean) => void;
  onLeave: (leaveId: string | null) => void;
}) {
  const working = cell.duty === "AM" || cell.duty === "PM" || cell.duty === "V";
  return (
    <td
      onClick={(e) => onClick(e.shiftKey)}
      className={cn(
        "h-12 cursor-pointer select-none border-b border-r p-0.5 align-top",
        day.locked && "bg-hatch",
        selected && "bg-primary/15 ring-2 ring-inset ring-primary",
      )}
    >
      <div className="relative flex flex-col items-center gap-0.5">
        <DutyChip duty={cell.duty} />
        {day.event && working && (
          <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-fuchsia-500" title={`Special Event: report at ${day.event.reportTime}`} />
        )}
        {cell.absences.map((a, i) => (
          <button
            key={a.leaveId ?? `${a.code}-${i}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onLeave(a.leaveId);
            }}
          >
            <LeaveChip absence={a} />
          </button>
        ))}
        {cell.task && <TaskTag name={cell.task.name} />}
      </div>
    </td>
  );
});
