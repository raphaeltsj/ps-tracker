"use client";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { approveLeave, assignDuty, assignExtraDuty, assignTask, cancelLeave, clearSpecialEvent, editLeave, giveLeave, lockDates, rejectLeave, requestLeave, setSpecialEvent, unlockDate } from "@/app/actions";
import { DosTag, DutyChip, EventBadge, LeaveChip, LockBadge, StatusBadge, TaskTag } from "@/components/roster/chips";
import { MyRequests } from "@/components/roster/my-requests";
import type { Selection, WorkspaceProps } from "@/components/roster/roster-workspace";
import { StrengthSummary } from "@/components/roster/strength-summary";
import { ResultMessage, useAction } from "@/components/roster/use-action";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cycleDayLabel, cyclePositionLabel } from "@/lib/cycle";
import { formatDate, formatDateList, formatDateShort } from "@/lib/dates";
import { ASSIGNABLE_DUTIES, DOS_KINDS, DOS_LABEL, DOS_OIL_CODE, DOS_REPORT_TIME, DUTY_LABEL, HALF_DAY_TIMES, type Duty, type Half } from "@/lib/domain";
import { canDecideLeave } from "@/lib/permissions";
import { isLeaveEntry, type LeaveSummary, type LeaveTypeOption, type RosterDay } from "@/lib/roster-types";
import { formatFigure } from "@/lib/strength";
import { cn } from "@/lib/utils";

type PanelProps = WorkspaceProps & {
  selection: Selection;
  onClear: () => void;
  onFocusLeave: (id: string | null) => void;
  onRemoveDate: (date: string) => void;
};

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-2.5 border-b px-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SidePanel(props: PanelProps) {
  const { mode, canEdit, canRequest, selection, roster, myLeaves, viewer } = props;
  const focusLeave = selection.focusLeaveId ? (roster.leaves[selection.focusLeaveId] ?? myLeaves.find((l) => l.id === selection.focusLeaveId)) : null;

  return (
    <div className="text-sm">
      {focusLeave && <LeaveDetail {...props} leave={focusLeave} />}
      {mode === "edit" && canEdit && <EditTools {...props} />}
      {mode === "staff" && canRequest && <RequestForm {...props} />}
      {selection.focusDate && <DateDetails {...props} date={selection.focusDate} />}
      {mode === "staff" && canRequest && (
        <Section title="My requests">
          <MyRequests leaves={myLeaves} viewer={viewer} onSelect={(id) => props.onFocusLeave(id)} />
        </Section>
      )}
      {mode === "staff" && canRequest && (
        <Section title="Leave taken this month">
          <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            Coming in a later release: how many leave days you took this month and how many remain.
          </p>
        </Section>
      )}
    </div>
  );
}

// ---------------- Date details ----------------

function DateDetails({ roster, viewer, date, onFocusLeave, canEdit, mode }: PanelProps & { date: string }) {
  const day = roster.days[date];
  const own = roster.cells[viewer.id]?.[date];
  if (!day) return null;
  return (
    <Section title={formatDate(date)}>
      {mode === "edit" && canEdit && <DateSettings shiftId={roster.shiftId} date={date} day={day} isManagement={viewer.role === "MANAGEMENT"} />}
      <p className="text-muted-foreground">
        {roster.shiftName}: {cycleDayLabel(roster.anchor, date)}
        {day.shiftDuty === "OFF" ? " (Rest day, MFL blank)" : " duty"}
      </p>
      {day.event && (
        <div className="space-y-1">
          <EventBadge note={day.event.note} />
        </div>
      )}
      {day.locked && (
        <div className="space-y-1 rounded-md border bg-hatch p-2">
          <LockBadge />
          <p className="text-xs">{day.locked}</p>
          <p className="text-[11px] text-muted-foreground">Staff cannot request leave on this date. Supervisors can still give leave.</p>
        </div>
      )}
      <StrengthSummary day={day} />
      {own && (
        <div className="space-y-1.5 rounded-md border p-2">
          <div className="text-xs font-medium text-muted-foreground">You on this date</div>
          <div className="flex flex-wrap items-center gap-1.5">
            <DutyChip duty={own.duty} long />
            {own.dos && <DosTag kind={own.dos} />}
            {own.task && <TaskTag name={own.task.name} />}
            {own.absences.map((a, i) => (
              <button key={i} onClick={() => onFocusLeave(a.leaveId)}>
                <LeaveChip absence={a} />
              </button>
            ))}
          </div>
          {own.absences.some((a) => a.derived) && (
            <p className="text-[11px] text-muted-foreground">BD is shown on your birthday; on an Off day it becomes BD-IL on your next working day.</p>
          )}
          <p className="text-[11px] text-muted-foreground">{cyclePositionLabel(roster.anchor, date)}</p>
        </div>
      )}
    </Section>
  );
}

/** Supervisors and Management: lock the date for events and set the special-event report time. */
function DateSettings({ shiftId, date, day, isManagement }: { shiftId: string; date: string; day: RosterDay; isManagement: boolean }) {
  const { pending, result, run } = useAction();
  const [remarks, setRemarks] = useState(day.locked ?? "");
  const [allShifts, setAllShifts] = useState(false);
  const [note, setNote] = useState(day.event?.note ?? "");
  const [open, setOpen] = useState<"lock" | "event" | null>(null);

  return (
    <div className="space-y-2 rounded-md border p-2">
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant={open === "lock" ? "secondary" : "outline"} onClick={() => setOpen(open === "lock" ? null : "lock")}>
          {day.locked ? "Edit lock" : "Lock date"}
        </Button>
        <Button size="sm" variant={open === "event" ? "secondary" : "outline"} onClick={() => setOpen(open === "event" ? null : "event")}>
          {day.event ? "Edit event" : "Special event"}
        </Button>
      </div>

      {open === "lock" && (
        <div className="space-y-2">
          <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} placeholder="Remarks: why is this date locked?" />
          {isManagement && (
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={allShifts} onChange={(e) => setAllShifts(e.target.checked)} className="size-4" />
              Lock on all shifts
            </label>
          )}
          <div className="flex gap-2">
            <Button size="sm" disabled={pending || !remarks.trim()} onClick={() => run(() => lockDates({ shiftId, dates: [date], remarks, allShifts }))}>
              {day.locked ? "Save lock" : "Lock date"}
            </Button>
            {day.locked && (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => unlockDate({ shiftId, date, allShifts }))}>
                Unlock
              </Button>
            )}
          </div>
        </div>
      )}

      {open === "event" && (
        <div className="space-y-2">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What is the event?" />
          <p className="text-[11px] text-muted-foreground">Special events are a marker for the whole shift: MFL and slots stay the same.</p>
          <div className="flex gap-2">
            <Button size="sm" disabled={pending || !note.trim()} onClick={() => run(() => setSpecialEvent({ shiftId, date, note }))}>
              {day.event ? "Save event" : "Set event"}
            </Button>
            {day.event && (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => clearSpecialEvent({ shiftId, date }))}>
                Remove event
              </Button>
            )}
          </div>
        </div>
      )}
      <ResultMessage result={result} />
    </div>
  );
}

// ---------------- Staff: request leave ----------------

function LeaveTypeSelect({ types, value, onChange, id }: { types: LeaveTypeOption[]; value: string; onChange: (v: string) => void; id: string }) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border bg-background px-2 text-sm"
    >
      <option value="">Choose a leave type</option>
      {types.map((t) => (
        <option key={t.code} value={t.code}>
          {t.code} - {t.name}
          {t.custom ? " (custom)" : ""}
        </option>
      ))}
    </select>
  );
}

function HalfPicker({ value, onChange, duty }: { value: Half | null; onChange: (h: Half) => void; duty: Duty | null }) {
  const times = duty ? HALF_DAY_TIMES[duty] : undefined;
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Which half">
      {(["FIRST", "SECOND"] as const).map((h) => (
        <button
          key={h}
          type="button"
          role="radio"
          aria-checked={value === h}
          onClick={() => onChange(h)}
          className={cn("rounded-md border px-2 py-1.5 text-left", value === h && "border-primary bg-primary/10")}
        >
          <span className="block text-sm font-medium">{h === "FIRST" ? "First half" : "Second half"}</span>
          <span className="block text-xs text-muted-foreground">{times ? times[h] : "Hours depend on the duty"}</span>
        </button>
      ))}
    </div>
  );
}

function RequestForm({ roster, viewer, selection, leaveTypes, onClear, onRemoveDate }: PanelProps) {
  const [typeCode, setTypeCode] = useState("");
  const [half, setHalf] = useState<Half | null>(null);
  const [notes, setNotes] = useState("");
  const { pending, result, run } = useAction();
  const dates = [...selection.dates].sort();
  const type = leaveTypes.find((t) => t.code === typeCode);
  const own = roster.cells[viewer.id];
  const needSlot = type?.halfDay ? 0.5 : 1;
  const tight = dates.filter((d) => roster.days[d].strength.slots < needSlot);
  // Only one type of leave per day.
  const taken = dates.filter((d) => own?.[d]?.absences.some(isLeaveEntry));
  // Management never requests leave; BD / BD-IL are derived from the birthday for now.
  const requestable = leaveTypes.filter((t) => t.code !== "BD" && t.code !== "BD-IL");

  return (
    <Section
      title="Request leave"
      action={
        dates.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        )
      }
    >
      {dates.length === 0 ? (
        <p className="text-muted-foreground">Select dates on the calendar or roster. Shift-click selects a range. Locked dates cannot be picked.</p>
      ) : (
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {dates.map((d) => {
            const s = roster.days[d].strength;
            return (
              <li key={d} className="flex items-center gap-2 rounded-md bg-muted/60 px-2 py-1">
                <span className="w-24">{formatDateShort(d)}</span>
                {own && <DutyChip duty={own[d].duty} />}
                {own?.[d].absences.map((a, i) => <LeaveChip key={i} absence={a} />)}
                <span className={cn("ml-auto text-xs tabular-nums", s.slots < needSlot ? "font-semibold text-red-700 dark:text-red-300" : "text-muted-foreground")}>
                  {s.status === "zero" ? "No slots" : `${formatFigure(s.slots)} slots`}
                </span>
                <button aria-label={`Remove ${d}`} onClick={() => onRemoveDate(d)}>
                  <X className="size-3.5 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <label className="block space-y-1" htmlFor="req-type">
        <span className="text-xs font-medium">Leave type</span>
        <LeaveTypeSelect id="req-type" types={requestable} value={typeCode} onChange={(v) => { setTypeCode(v); setHalf(null); }} />
      </label>
      {type?.halfDay && <HalfPicker value={half} onChange={setHalf} duty={dates[0] && own ? own[dates[0]].duty : null} />}
      <label className="block space-y-1">
        <span className="text-xs font-medium">Additional notes for your supervisor</span>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} placeholder="Optional" />
      </label>
      {taken.length > 0 && (
        <p className="rounded-md bg-red-50 p-2 text-xs font-medium text-red-800 dark:bg-red-500/10 dark:text-red-200">
          You already have leave on {formatDateList(taken)}. Only one type of leave is allowed per day, so remove those dates.
        </p>
      )}
      {tight.length > 0 && (
        <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          No slot left on {formatDateList(tight)}. You can still submit; your supervisor decides.
        </p>
      )}
      <Button
        className="w-full"
        disabled={pending || dates.length === 0 || taken.length > 0 || !type || (type.halfDay && !half)}
        onClick={() =>
          run(
            () => requestLeave({ typeCode, dates, half, notes }),
            () => {
              onClear();
              setNotes("");
              setTypeCode("");
              setHalf(null);
            },
          )
        }
      >
        {pending ? "Submitting..." : `Submit request${dates.length ? ` (${dates.length} day${dates.length > 1 ? "s" : ""})` : ""}`}
      </Button>
      <ResultMessage result={result} />
    </Section>
  );
}

// ---------------- Leave detail (view, review, edit, cancel) ----------------

function LeaveDetail({ leave, viewer, mode, canEdit, leaveTypes, selection, onFocusLeave, onClear }: PanelProps & { leave: LeaveSummary }) {
  const { pending, result, run } = useAction();
  const [editing, setEditing] = useState(false);
  const [typeCode, setTypeCode] = useState(leave.typeCode);
  const [half, setHalf] = useState<Half | null>(leave.half);
  const [remarks, setRemarks] = useState(leave.remarks ?? "");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);

  const active = leave.status === "APPROVED" || leave.status === "PENDING";
  const editable = mode === "edit" && canEdit && active;
  const cancellable = editable && !leave.auto;
  const decidable = leave.status === "PENDING" && canDecideLeave(viewer, leave.staffId, leave.shiftId) && (mode === "edit" || leave.staffId === viewer.id);
  const type = leaveTypes.find((t) => t.code === typeCode);
  // Selected cells that all belong to this person can replace the leave dates.
  const selectedDates = [...selection.cells].filter((k) => k.startsWith(`${leave.staffId}|`)).map((k) => k.split("|")[1]);
  const onlyThisPerson = selectedDates.length > 0 && selectedDates.length === selection.cells.size;

  return (
    <Section
      title={leave.staffId === viewer.id ? "Your leave" : `Leave: ${leave.staffName}`}
      action={
        <Button variant="ghost" size="icon" aria-label="Close leave details" onClick={() => onFocusLeave(null)}>
          <X className="size-4" />
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <LeaveChip absence={{ code: leave.typeCode, half: leave.half, status: leave.status, counts: 1, derived: false }} />
        <span className="font-medium">{leave.typeName}</span>
        <StatusBadge status={leave.status} />
      </div>
      <p>{formatDateList(leave.days)}</p>
      {leave.half && <p className="text-xs text-muted-foreground">{leave.half === "FIRST" ? "First" : "Second"} half</p>}
      {leave.givenByName && <p className="text-xs text-muted-foreground">Given by {leave.givenByName}: already approved.</p>}
      {leave.notes && <p className="text-xs">Staff notes: {leave.notes}</p>}
      {leave.remarks && !editing && <p className="text-xs">Remarks: {leave.remarks}</p>}
      {leave.rejectReason && <p className="text-xs text-red-700 dark:text-red-300">Reject reason: {leave.rejectReason}</p>}
      {leave.status === "PENDING" && <p className="text-xs text-muted-foreground">Submitted {new Date(leave.submittedAt).toLocaleString()}</p>}
      {leave.auto && (
        <p className="rounded-md bg-muted p-2 text-xs">
          This {DOS_OIL_CODE} comes with the {DOS_LABEL} duty. You can change which half it covers, but not its type or date, and it cannot be cancelled. Remove the duty
          instead.
        </p>
      )}

      {decidable && !rejecting && (
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <Button size="sm" disabled={pending || Boolean(leave.noSlotOn)} onClick={() => run(() => approveLeave(leave.id))}>
              Approve
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => setRejecting(true)}>
              Reject
            </Button>
          </div>
          {leave.noSlotOn && <p className="text-xs font-medium text-red-700 dark:text-red-300">No slot available on {formatDate(leave.noSlotOn)}</p>}
        </div>
      )}
      {rejecting && (
        <div className="space-y-2">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Reason (required)" />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" disabled={pending || !reason.trim()} onClick={() => run(() => rejectLeave(leave.id, reason), () => setRejecting(false))}>
              Confirm reject
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
              Back
            </Button>
          </div>
        </div>
      )}

      {editable && !editing && !confirmCancel && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            {leave.auto ? "Change half" : "Edit leave"}
          </Button>
          {cancellable && (
            <Button size="sm" variant="outline" className="text-red-700 dark:text-red-300" onClick={() => setConfirmCancel(true)}>
              {leave.status === "PENDING" ? "Cancel request" : "Cancel leave"}
            </Button>
          )}
        </div>
      )}
      {confirmCancel && (
        <div className="space-y-2 rounded-md border border-red-300 p-2 dark:border-red-500/40">
          <p className="text-xs">
            {leave.status === "PENDING" ? "Cancel this pending request?" : "Cancel this approved leave? The slot is freed straight away."}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" disabled={pending} onClick={() => run(() => cancelLeave(leave.id), () => onFocusLeave(null))}>
              {leave.status === "PENDING" ? "Yes, cancel request" : "Yes, cancel leave"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(false)}>
              Keep it
            </Button>
          </div>
        </div>
      )}
      {editing && (
        <div className="space-y-2 rounded-md border p-2">
          {!leave.auto && <LeaveTypeSelect id="edit-type" types={leaveTypes} value={typeCode} onChange={(v) => { setTypeCode(v); setHalf(null); }} />}
          {type?.halfDay && <HalfPicker value={half} onChange={setHalf} duty={null} />}
          <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} placeholder="Remarks" />
          {leave.auto ? (
            <p className="text-xs text-muted-foreground">Only the half can change: this {DOS_OIL_CODE} stays on {formatDateList(leave.days)}.</p>
          ) : onlyThisPerson ? (
            <p className="text-xs text-muted-foreground">Dates will change to your selection: {formatDateList(selectedDates)}.</p>
          ) : (
            <p className="text-xs text-muted-foreground">To change dates, select this person&apos;s new dates on the roster first.</p>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pending || !type || (type.halfDay && !half)}
              onClick={() =>
                run(
                  () => editLeave({ leaveId: leave.id, typeCode, half, remarks, dates: !leave.auto && onlyThisPerson ? selectedDates : undefined }),
                  () => {
                    setEditing(false);
                    onClear();
                  },
                )
              }
            >
              Save changes
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Back
            </Button>
          </div>
        </div>
      )}
      <ResultMessage result={result} />
    </Section>
  );
}

// ---------------- Edit view: duties, Tasks, give leave ----------------

function EditTools(props: PanelProps) {
  const { selection, roster, tasks, leaveTypes, onClear } = props;
  const [tab, setTab] = useState<"duty" | "task" | "leave">("duty");
  const { pending, result, run } = useAction();
  const [duty, setDuty] = useState<string>("");
  const [dos, setDos] = useState<string>("");
  const [taskId, setTaskId] = useState<string>("");
  const [typeCode, setTypeCode] = useState("");
  const [half, setHalf] = useState<Half | null>(null);
  const [remarks, setRemarks] = useState("");

  const cells = useMemo(
    () => [...selection.cells].map((k) => ({ staffId: k.split("|")[0], date: k.split("|")[1] })),
    [selection.cells],
  );
  const byStaff = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const c of cells) (map[c.staffId] ??= []).push(c.date);
    return map;
  }, [cells]);
  const names = Object.keys(byStaff).map((id) => roster.staff.find((s) => s.id === id)?.name ?? "?");
  const onFullLeave = cells.filter((c) => roster.cells[c.staffId]?.[c.date]?.absences.some((a) => a.status === "APPROVED" && a.counts >= 1)).length;
  // Only one type of leave per day: cells that already hold leave cannot be given more.
  const withLeave = cells.filter((c) => roster.cells[c.staffId]?.[c.date]?.absences.some(isLeaveEntry));
  const type = leaveTypes.find((t) => t.code === typeCode);

  return (
    <Section
      title="Edit selection"
      action={
        cells.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        )
      }
    >
      {cells.length === 0 ? (
        <p className="text-muted-foreground">
          Click cells to select people and dates (shift-click for a range in a row). Click a leave chip to edit or cancel it, or a date header for that date&apos;s settings.
        </p>
      ) : (
        <p>
          <span className="font-medium">{cells.length} cell{cells.length > 1 ? "s" : ""}</span>{" "}
          <span className="text-muted-foreground">
            ({names.length} {names.length === 1 ? "person" : "people"}: {names.slice(0, 4).join(", ")}
            {names.length > 4 ? ` +${names.length - 4}` : ""})
          </span>
        </p>
      )}

      <div className="grid grid-cols-3 rounded-lg border p-0.5" role="tablist">
        {(
          [
            ["duty", "Duty"],
            ["task", "Task"],
            ["leave", "Give leave"],
          ] as const
        ).map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={cn("rounded-md py-1 text-sm", tab === key ? "bg-secondary font-semibold" : "text-muted-foreground")}>
            {label}
          </button>
        ))}
      </div>

      {tab === "duty" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            AM and PM come from the shift cycle and are not set by hand. Assigning a 2-day V turns the next PM block into Off(V) by itself; resetting the V duty puts that PM block back.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ASSIGNABLE_DUTIES.map((d) => {
              const shown = d === "OFF" ? "OFF_V" : d;
              return (
                <button key={d} onClick={() => setDuty(d)} className={cn("rounded-md border p-1", duty === d && "border-primary ring-2 ring-primary")} aria-pressed={duty === d}>
                  <DutyChip duty={shown as Duty} long />
                </button>
              );
            })}
            <button onClick={() => setDuty("CYCLE")} className={cn("rounded-md border px-2 py-1 text-xs", duty === "CYCLE" && "border-primary ring-2 ring-primary")} aria-pressed={duty === "CYCLE"}>
              Reset to cycle
            </button>
          </div>
          <Button className="w-full" disabled={pending || !duty || cells.length === 0} onClick={() => run(() => assignDuty({ cells, duty }), onClear)}>
            {duty === "CYCLE" ? "Reset to normal cycle" : duty ? `Assign ${DUTY_LABEL[(duty === "OFF" ? "OFF_V" : duty) as Duty]}` : "Pick a duty above"}
          </Button>

          <div className="space-y-2 rounded-md border p-2">
            <p className="text-xs font-medium">{DOS_LABEL} duty</p>
            <p className="text-xs text-muted-foreground">
              One day only, on an AM day. 24 hours, report at {DOS_REPORT_TIME}, on top of the shift duty, and a Task is still allowed. A {DOS_OIL_CODE} (first half) is added the next day
              automatically and cannot be cancelled on its own.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DOS_KINDS.map((k) => (
                <button
                  key={k}
                  onClick={() => setDos(k)}
                  aria-pressed={dos === k}
                  className={cn("rounded-md border px-2 py-1 text-xs font-semibold", dos === k && "border-primary ring-2 ring-primary")}
                >
                  {k}
                </button>
              ))}
              <button
                onClick={() => setDos("NONE")}
                aria-pressed={dos === "NONE"}
                className={cn("rounded-md border px-2 py-1 text-xs", dos === "NONE" && "border-primary ring-2 ring-primary")}
              >
                Remove
              </button>
            </div>
            <Button
              variant="outline"
              className="w-full"
              disabled={pending || !dos || cells.length === 0}
              onClick={() => run(() => assignExtraDuty({ cells, kind: dos === "NONE" ? null : dos }), onClear)}
            >
              {dos === "NONE" ? `Remove ${DOS_LABEL} duty` : dos ? `Assign ${dos}` : `Pick a ${DOS_LABEL} type above`}
            </Button>
          </div>
        </div>
      )}

      {tab === "task" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Optional. One Task per person per day, including people on V duty. Several people can share a Task. Not available on full-day leave.</p>
          <select value={taskId} onChange={(e) => setTaskId(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm" aria-label="Task">
            <option value="">Choose a Task</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            <option value="__none">No Task (remove)</option>
          </select>
          {onFullLeave > 0 && taskId && taskId !== "__none" && (
            <p className="text-xs text-amber-800 dark:text-amber-200">{onFullLeave} selected cell(s) are on full-day leave and will be skipped.</p>
          )}
          <Button
            className="w-full"
            disabled={pending || !taskId || cells.length === 0}
            onClick={() => run(() => assignTask({ cells, taskId: taskId === "__none" ? null : taskId }), onClear)}
          >
            {taskId === "__none" ? "Remove Task" : "Assign Task"}
          </Button>
        </div>
      )}

      {tab === "leave" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Leave you give is already approved. Locked dates and Off days are allowed. You can include yourself.</p>
          {Object.entries(byStaff).map(([id, ds]) => (
            <p key={id} className="text-xs">
              <span className="font-medium">{roster.staff.find((s) => s.id === id)?.name}</span>: {formatDateList(ds)}
            </p>
          ))}
          <LeaveTypeSelect id="give-type" types={leaveTypes} value={typeCode} onChange={(v) => { setTypeCode(v); setHalf(null); }} />
          {type?.halfDay && <HalfPicker value={half} onChange={setHalf} duty={cells[0] ? roster.cells[cells[0].staffId][cells[0].date].duty : null} />}
          <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} placeholder="Remarks (optional)" />
          {withLeave.length > 0 && (
            <p className="rounded-md bg-red-50 p-2 text-xs font-medium text-red-800 dark:bg-red-500/10 dark:text-red-200">
              {withLeave.length} selected cell{withLeave.length > 1 ? "s" : ""} already {withLeave.length > 1 ? "have" : "has"} leave (
              {withLeave
                .slice(0, 3)
                .map((c) => `${roster.staff.find((s) => s.id === c.staffId)?.name} ${formatDateShort(c.date)}`)
                .join(", ")}
              {withLeave.length > 3 ? ", ..." : ""}). Only one type of leave per day: edit or cancel that leave instead.
            </p>
          )}
          <Button
            className="w-full"
            disabled={pending || !type || (type.halfDay && !half) || cells.length === 0 || withLeave.length > 0}
            onClick={() =>
              run(() => giveLeave({ staffDates: byStaff, typeCode, half, remarks }), () => {
                onClear();
                setRemarks("");
              })
            }
          >
            Give leave
          </Button>
        </div>
      )}
      <ResultMessage result={result} />
    </Section>
  );
}
