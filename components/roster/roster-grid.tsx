"use client";
import { memo, useEffect, useRef } from "react";
import { CalendarClock, Lock } from "lucide-react";
import { DosTag, DUTY_CELL, DUTY_ON_LEAVE_CELL, DUTY_ON_LEAVE_TITLE, DutyChip, DutyLegend, dutyTitle, LABELLED_DUTIES, LeaveChip, PendingTag, SLOT_BG, SLOT_STYLE, SwapTag, swapTitle, TaskTag } from "@/components/roster/chips";
import { BottomRows } from "@/components/roster/bottom-rows";
import { cellKey, type Selection, type WorkspaceProps } from "@/components/roster/roster-workspace";
import { isWeekend, weekdayShort } from "@/lib/dates";
import type { RosterCell, RosterDay } from "@/lib/roster-types";
import { formatFigure } from "@/lib/strength";
import { cn } from "@/lib/utils";

type GridProps = WorkspaceProps & {
  selection: Selection;
  compact: boolean;
  onDate: (date: string) => void;
  onCell: (staffId: string, date: string, shiftKey: boolean) => void;
  onLeave: (leaveId: string | null, date: string) => void;
};

const SHIFT_DUTY_LABEL = { AM: "AM", PM: "PM", OFF: "Rest day" } as const;

// Remembers where the grid was scrolled horizontally, so switching shift or month (which reloads
// this component) doesn't force a supervisor working near month-end to scroll right again.
const SCROLL_KEY = "ps-roster-scroll-x";

/** Desktop month grid: sticky name column, sticky date header with strength rows directly below. */
export function RosterGrid({ roster, selection, compact, today, viewer, mode, canEdit, onDate, onCell, onLeave }: GridProps) {
  const { dates, days } = roster;
  const scrollRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Land on today's column (not the 1st of the month) so picking a date for a swap or leave request
  // doesn't start by showing only past, unselectable days. But if the viewer already scrolled
  // somewhere this session (e.g. near month-end) and then switched shift or month, which remounts
  // this grid, restore that instead of snapping back to today every time.
  const todayRef = useRef<HTMLTableCellElement>(null);
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(SCROLL_KEY);
    } catch {}
    if (saved && scrollRef.current) scrollRef.current.scrollLeft = Number(saved);
    else todayRef.current?.scrollIntoView({ inline: "start", block: "nearest" });
  }, [roster.shiftId, roster.dates]);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const left = e.currentTarget.scrollLeft;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        sessionStorage.setItem(SCROLL_KEY, String(left));
      } catch {}
    }, 150);
  };

  const strengthRows: { label: string; value: (d: RosterDay) => React.ReactNode; cls?: (d: RosterDay) => string }[] = [
    { label: "Total Strength", value: (d) => d.strength.total },
    { label: "Not in Strength", value: (d) => formatFigure(d.strength.notIn) },
    { label: "Working Strength", value: (d) => formatFigure(d.strength.working) },
    { label: "MFL", value: (d) => (d.strength.mfl === null ? <span className="text-muted-foreground">–</span> : d.strength.mfl) },
  ];

  return (
    <div className="flex h-full flex-col">
      <DutyLegend className="border-b px-4 py-1.5" />
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-auto">
        <table className="border-separate border-spacing-0 text-xs">
          <thead className="sticky top-0 z-20 bg-background">
            <tr>
              <th className="sticky left-0 z-30 min-w-28 border-b border-r bg-background px-3 py-1.5 text-left font-semibold lg:min-w-40">
                {roster.shiftName}
                <span className="block font-normal text-muted-foreground">{roster.staff.length} staff</span>
              </th>
              {dates.map((date) => {
                const day = days[date];
                const selected = selection.dates.has(date) || selection.focusDate === date;
                return (
                  <th
                    key={date}
                    ref={date === today ? todayRef : undefined}
                    onClick={() => onDate(date)}
                    title={`Open the details for ${date}`}
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
                    <div className="flex h-3.5 items-center justify-center gap-0.5 text-[10px] text-muted-foreground">
                      {/* Shift duty by colour only; name in the tooltip and for screen readers. */}
                      <span className={cn("h-2 w-6 rounded-full", DUTY_CELL[day.shiftDuty])} title={SHIFT_DUTY_LABEL[day.shiftDuty]} />
                      <span className="sr-only">{SHIFT_DUTY_LABEL[day.shiftDuty]}</span>
                      {day.locked && <Lock className="size-3 text-foreground" aria-label="Locked date" />}
                      {day.event && <CalendarClock className="size-3 text-fuchsia-600 dark:text-fuchsia-400" aria-label="Special event" />}
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
                    selected={
                      (selection.focusStaffId === person.id && selection.focusDate === date) ||
                      (mode === "edit" ? selection.cells.has(cellKey(person.id, date)) : person.id === viewer.id && selection.dates.has(date))
                    }
                    onClick={(shiftKey) => onCell(person.id, date, shiftKey)}
                    onLeave={(leaveId) => onLeave(leaveId, date)}
                  />
                ))}
              </tr>
            ))}
            <BottomRows roster={roster} mode={mode} canEdit={canEdit} selection={selection} onDate={onDate} onCell={onCell} />
          </tbody>
        </table>
      </div>
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
      title={[cell.swap ? swapTitle(cell.swap, cell.duty) : dutyTitle(cell.duty), cell.dutyOnLeave && DUTY_ON_LEAVE_TITLE].filter(Boolean).join(". ")}
      className={cn(
        // Vertically centered: a cell with just a duty (no leave/DOS/Task chip below) isn't pinned to the top.
        "h-12 cursor-pointer select-none border-b border-r border-background/60 p-0.5 align-middle",
        cell.dutyOnLeave ? DUTY_ON_LEAVE_CELL : DUTY_CELL[cell.duty],
        day.locked && "bg-hatch",
        selected && "outline-2 outline-solid -outline-offset-2 outline-primary",
      )}
    >
      <div className="relative flex flex-col items-center gap-0.5">
        {/* AM, PM and Off are colour-coded (legend above); only V and V(SB) keep a text label. */}
        {LABELLED_DUTIES.includes(cell.duty) ? <DutyChip duty={cell.duty} /> : <span className="sr-only">{dutyTitle(cell.duty)}</span>}
        {cell.dutyOnLeave && <PendingTag />}
        {day.event && working && (
          <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-fuchsia-500" title={day.event.note ? `Special Event: ${day.event.note}` : "Special Event"} />
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
        {cell.swap && <SwapTag swap={cell.swap} duty={cell.duty} />}
        {cell.dos && <DosTag kind={cell.dos} />}
        {cell.task && <TaskTag name={cell.task.name} />}
      </div>
    </td>
  );
});
