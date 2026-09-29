"use client";
import { useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import {
  DosTag,
  DUTY_CELL,
  DUTY_ON_LEAVE_CELL,
  DUTY_ON_LEAVE_TITLE,
  DutyChip,
  DutyLegend,
  dutyTitle,
  EventBadge,
  ExtraChip,
  LABELLED_DUTIES,
  LeaveChip,
  LockBadge,
  OpsChip,
  PendingTag,
  SwapTag,
  swapTitle,
  TaskTag,
} from "@/components/roster/chips";
import { StrengthSummary } from "@/components/roster/strength-summary";
import { cellKey, type Selection, type WorkspaceProps } from "@/components/roster/roster-workspace";
import { Button } from "@/components/ui/button";
import { cycleDayLabel } from "@/lib/cycle";
import { formatDate, weekdayShort } from "@/lib/dates";
import { ROW_EXTRA, ROW_OPS } from "@/lib/roster-types";
import { cn } from "@/lib/utils";

/** Mobile roster: a week strip with a day-by-day agenda, not a shrunken table (spec 14.1). */
export function MobileRoster({
  roster,
  selection,
  compact,
  today,
  viewer,
  mode,
  canEdit,
  canRequest,
  canRequestLocked,
  onDate,
  onFocusDate,
  onCell,
  onPerson,
  onLeave,
}: WorkspaceProps & {
  selection: Selection;
  compact: boolean;
  onDate: (date: string, shiftKey: boolean) => void;
  onFocusDate: (date: string, openSheet?: boolean) => void;
  onCell: (staffId: string, date: string, shiftKey: boolean) => void;
  onPerson: (staffId: string, date: string) => void;
  onLeave: (leaveId: string | null, date: string) => void;
}) {
  const initial = roster.dates.includes(today) ? today : roster.dates[0];
  const [day, setDay] = useState(initial);
  const [weekStart, setWeekStart] = useState(Math.floor(roster.dates.indexOf(initial) / 7) * 7);
  const week = roster.dates.slice(weekStart, weekStart + 7);
  const info = roster.days[day];
  const selectedForLeave = selection.dates.has(day);

  return (
    <div className="pb-40">
      <div className="flex items-center gap-1 border-b px-2 py-2">
        <Button variant="ghost" size="icon" aria-label="Previous week" disabled={weekStart === 0} onClick={() => setWeekStart((w) => Math.max(0, w - 7))}>
          <ChevronLeft className="size-4" />
        </Button>
        {/* Fixed-width columns would leave dead space when a month's last week is short (e.g. 2
            days), since every month but a 28-day one ends on a partial week. Sizing columns to the
            actual day count keeps that row filling the strip like every other week. */}
        <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${week.length}, minmax(0, 1fr))` }}>
          {week.map((d) => {
            const dd = roster.days[d];
            return (
              <button
                key={d}
                onClick={() => {
                  setDay(d);
                  // Just browsing the strip: the day card below already shows this date's event,
                  // lock and strength inline, so don't pop the sheet open over the person list.
                  onFocusDate(d, false);
                }}
                className={cn(
                  "flex flex-col items-center rounded-lg py-1 text-xs",
                  d === day ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                  selection.dates.has(d) && d !== day && "ring-2 ring-primary",
                )}
              >
                <span className="text-[10px] uppercase opacity-70">{weekdayShort(d)}</span>
                <span className="text-sm font-semibold">{Number(d.slice(8))}</span>
                <span className="flex h-3 items-center gap-0.5">
                  {dd.locked && <Lock className="size-2.5" />}
                  {dd.event && <CalendarClock className="size-2.5" />}
                </span>
              </button>
            );
          })}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Next week"
          disabled={weekStart + 7 >= roster.dates.length}
          onClick={() => setWeekStart((w) => Math.min(roster.dates.length - 1, w + 7))}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Day card */}
      <div className="space-y-2 border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">{formatDate(day)}</div>
            <div className="text-xs text-muted-foreground">
              <span className={cn("mr-1.5 inline-block h-2 w-6 rounded-full align-middle", DUTY_CELL[info.shiftDuty])} aria-hidden />
              {roster.shiftName}: {cycleDayLabel(roster.anchor, day)}
              {info.shiftDuty === "OFF" ? " (Rest day)" : ""}
            </div>
          </div>
          {mode === "staff" && canRequest && (canRequestLocked || !info.locked) && (
            <Button size="sm" variant={selectedForLeave ? "default" : "outline"} onClick={() => onDate(day, false)}>
              {selectedForLeave ? "Selected" : "Select for leave"}
            </Button>
          )}
        </div>
        {info.event && <EventBadge note={info.event.note} />}
        {info.locked && (
          <div className="space-y-1">
            <LockBadge />
            <p className="text-xs text-muted-foreground">{info.locked}</p>
          </div>
        )}
        <StrengthSummary day={info} compact={compact} />
        <DutyLegend />
      </div>

      <ul className="divide-y">
        {roster.staff.map((p) => {
          const cell = roster.cells[p.id][day];
          const selected = selection.cells.has(cellKey(p.id, day)) || (selection.focusStaffId === p.id && selection.focusDate === day);
          return (
            <li
              key={p.id}
              onClick={() => (mode === "edit" && canEdit ? onCell(p.id, day, false) : onPerson(p.id, day))}
              className={cn("flex items-center gap-2 px-4 py-2", p.id === viewer.id && "bg-accent/60", selected && "bg-primary/15")}
            >
              <span className="flex-1 text-sm">
                {p.name}
                {p.role === "SUPERVISOR" && <span className="ml-1 text-[10px] text-muted-foreground">Sup</span>}
              </span>
              {cell.swap && <SwapTag swap={cell.swap} duty={cell.duty} />}
              {cell.dos && <DosTag kind={cell.dos} />}
              {cell.task && <TaskTag name={cell.task.name} />}
              {cell.dutyOnLeave && <PendingTag />}
              {cell.absences.map((a, i) => (
                <button
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    onLeave(a.leaveId, day);
                  }}
                >
                  <LeaveChip absence={a} />
                </button>
              ))}
              {/* AM, PM and Off by colour only; V and V(SB) keep their label. */}
              <span
                className={cn("grid h-6 w-12 place-items-center rounded-md", cell.dutyOnLeave ? DUTY_ON_LEAVE_CELL : DUTY_CELL[cell.duty])}
                title={[cell.swap ? swapTitle(cell.swap, cell.duty) : dutyTitle(cell.duty), cell.dutyOnLeave && DUTY_ON_LEAVE_TITLE].filter(Boolean).join(". ")}
              >
                {LABELLED_DUTIES.includes(cell.duty) ? <DutyChip duty={cell.duty} /> : <span className="sr-only">{dutyTitle(cell.duty)}</span>}
              </span>
            </li>
          );
        })}
      </ul>

      {/* The bottom rows of the roster, for this day. Support and Recall are placeholders. */}
      <h3 className="border-t px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Other duties</h3>
      <ul className="divide-y">
        {(
          [
            { id: "support", label: "Support (AM/PM)", soon: true },
            { id: ROW_EXTRA, label: "Extra", soon: false },
            { id: "recall", label: "Recall", soon: true },
            { id: ROW_OPS, label: "Ops duty", soon: false },
          ] as const
        ).map((row) => {
          const editable = mode === "edit" && canEdit && !row.soon;
          const ops = row.id === ROW_OPS ? (roster.ops[day] ?? []) : [];
          const extra = row.id === ROW_EXTRA ? (roster.extra[day] ?? []) : [];
          return (
            <li
              key={row.id}
              onClick={() => editable && onCell(row.id, day, false)}
              className={cn("flex items-start gap-3 px-4 py-2.5 text-sm", row.soon && "bg-muted/40", selection.cells.has(cellKey(row.id, day)) && "bg-primary/15")}
            >
              <span className={cn("w-28 shrink-0 text-xs font-bold uppercase tracking-wide", row.soon && "text-muted-foreground")}>{row.label}</span>
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                {row.soon && <span className="text-xs text-muted-foreground">Not active yet</span>}
                {ops.map((o) => (
                  <span key={o.dayworkerId} className="flex items-center gap-1.5">
                    <OpsChip entry={o} />
                    <span className="text-xs text-muted-foreground">{o.name}</span>
                  </span>
                ))}
                {extra.map((e) => (
                  <span key={e.staffId} className="flex items-center gap-1.5">
                    <ExtraChip entry={e} />
                    <span className="text-xs text-muted-foreground">Shift {e.fromShiftId}</span>
                  </span>
                ))}
                {!row.soon && ops.length + extra.length === 0 && <span className="text-xs text-muted-foreground">None{editable ? ". Tap to add." : ""}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
