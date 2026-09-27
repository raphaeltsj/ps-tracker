"use client";
import { CalendarClock, Lock } from "lucide-react";
import { DosTag, DutyChip, LeaveChip, SLOT_BG, SLOT_STYLE, SwapTag, TaskTag } from "@/components/roster/chips";
import type { Selection, WorkspaceProps } from "@/components/roster/roster-workspace";
import { weekday } from "@/lib/dates";
import type { Duty } from "@/lib/domain";
import { formatFigure } from "@/lib/strength";
import { cn } from "@/lib/utils";

const HEAD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Month calendar: each date's duty and Available Slot(s) at a glance (spec 8.1, screen 2). */
export function CalendarView({
  roster,
  viewer,
  selection,
  compact,
  today,
  onDate,
}: WorkspaceProps & { selection: Selection; compact: boolean; onDate: (date: string, shiftKey: boolean) => void }) {
  const own = roster.cells[viewer.id]; // present when viewing your own shift
  const lead = (weekday(roster.dates[0]) + 6) % 7; // Monday-first

  return (
    <div className="h-full overflow-auto p-3 pb-40 sm:p-4 lg:pb-4">
      <p className="mb-2 text-xs text-muted-foreground">
        {own ? "Your duty on each date" : `${roster.shiftName} duty on each date`} with Available Slot(s). Click dates to select, shift-click for a range.
      </p>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {HEAD.map((h) => (
          <div key={h} className="pb-1 text-center text-[11px] font-medium uppercase text-muted-foreground">
            {h}
          </div>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <div key={`lead-${i}`} />
        ))}
        {roster.dates.map((date) => {
          const day = roster.days[date];
          const cell = own?.[date];
          const duty: Duty = cell?.duty ?? day.shiftDuty;
          const selected = selection.dates.has(date);
          const focused = selection.focusDate === date;
          const hasRemarks = Boolean(day.locked || day.event || cell?.absences.length);
          const s = day.strength;
          return (
            <button
              key={date}
              type="button"
              onClick={(e) => onDate(date, e.shiftKey)}
              aria-pressed={selected}
              aria-label={`${date}${day.locked ? ", locked date" : ""}`}
              className={cn(
                "relative flex min-h-20 flex-col items-stretch gap-1 rounded-lg border p-1.5 text-left transition-colors hover:bg-accent sm:min-h-24",
                day.locked && "bg-hatch",
                selected && "border-primary bg-primary/10 ring-2 ring-primary",
                focused && !selected && "border-foreground/40",
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("text-sm font-semibold", date === today && "rounded-full bg-primary px-1.5 text-primary-foreground")}>{Number(date.slice(8))}</span>
                <span className="flex items-center gap-0.5">
                  {day.event && <CalendarClock className="size-3.5 text-fuchsia-600 dark:text-fuchsia-400" aria-label="Special event" />}
                  {day.locked && <Lock className="size-3.5" aria-label="Locked date" />}
                  {hasRemarks && <span className="size-1.5 rounded-full bg-foreground/60" aria-label="Has remarks" />}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-0.5">
                {duty === "OFF" && !cell ? (
                  <span className="text-[11px] text-muted-foreground">Rest day</span>
                ) : (
                  <DutyChip duty={duty} />
                )}
                {cell?.absences.map((a, i) => <LeaveChip key={i} absence={a} />)}
                {cell?.swap && <SwapTag swap={cell.swap} duty={cell.duty} />}
                {cell?.dos && <DosTag kind={cell.dos} />}
                {cell?.task && <TaskTag name={cell.task.name} />}
              </div>
              <span
                className={cn("mt-auto self-start rounded px-1 text-[11px] tabular-nums", SLOT_STYLE[s.status], SLOT_BG[s.status])}
                title={`Available Slot(s)${compact ? "" : `: Total ${s.total}, Not in ${formatFigure(s.notIn)}, MFL ${s.mfl ?? "blank"}`}`}
              >
                {s.status === "zero" ? "No slots" : s.status === "below" ? `⚠ ${formatFigure(s.slots)}` : `${formatFigure(s.slots)} slots`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
