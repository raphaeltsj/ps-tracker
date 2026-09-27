"use server";
// All mutations. Every action re-checks permissions with lib/permissions.ts: hiding a button in the
// UI is never the only protection.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { endSession, requireViewer, startSession } from "@/lib/auth";
import { dosEarnsOil } from "@/lib/cycle";
import { addDays, formatDate, isValidDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { normalizeDayworkerName, normalizeUsername } from "@/lib/dayworkers";
import { ASSIGNABLE_DUTIES, DOS_KINDS, DOS_LABEL, DOS_OIL_CODE, NAME_MAX, type Half } from "@/lib/domain";
import { createDosOil } from "@/lib/dos-oil";
import {
  canDecideLeave,
  canEditShift,
  canManageDayworkers,
  canManageTasks,
  canRequestLeave,
  canRequestOnLockedDate,
  type Viewer,
} from "@/lib/permissions";
import { buildRoster } from "@/lib/roster-data";
import { findLeaveConflict } from "@/lib/leave-rules";
import { datesWithoutSlot } from "@/lib/slots";
import { formatFigure } from "@/lib/strength";
import { swapLockMessage } from "@/lib/swap-data";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });
const MAX_DAYS = 62;

function done(message?: string): ActionResult {
  revalidatePath("/", "layout");
  return { ok: true, message };
}

function cleanDates(dates: unknown): string[] | null {
  if (!Array.isArray(dates) || dates.length === 0 || dates.length > MAX_DAYS) return null;
  if (!dates.every((d) => typeof d === "string" && isValidDate(d))) return null;
  return [...new Set(dates as string[])].sort();
}

function cleanText(text: unknown, max = 500): string | null {
  if (typeof text !== "string") return null;
  const t = text.trim().slice(0, max);
  return t.length ? t : null;
}

async function leaveTypeOrNull(code: unknown) {
  return typeof code === "string" ? db.leaveType.findUnique({ where: { code } }) : null;
}

function halfFor(halfDay: boolean, half: unknown): Half | null | "invalid" {
  if (!halfDay) return null;
  return half === "FIRST" || half === "SECOND" ? half : "invalid";
}

/** Duties cannot be assigned on a day the person is on leave (spec 5.1). */
async function firstCellOnLeave(cells: CellRef[]): Promise<string | null> {
  const byStaff = new Map<string, string[]>();
  for (const { staffId, date } of cells) byStaff.set(staffId, [...(byStaff.get(staffId) ?? []), date]);
  for (const [staffId, dates] of byStaff) {
    const clash = await findLeaveConflict(staffId, dates);
    if (clash) {
      const staff = await db.staff.findUnique({ where: { id: staffId } });
      return `${staff?.name ?? "This person"} has ${clash.code} on ${formatDate(clash.date)}, so no duty can be assigned that day.`;
    }
  }
  return null;
}

/** Duties cannot change on a date an approved duty swap holds (spec 11.4). Tasks still can. */
async function firstCellSwapped(cells: CellRef[]): Promise<string | null> {
  const byStaff = new Map<string, string[]>();
  for (const { staffId, date } of cells) byStaff.set(staffId, [...(byStaff.get(staffId) ?? []), date]);
  for (const [staffId, dates] of byStaff) {
    const staff = await db.staff.findUnique({ where: { id: staffId } });
    const message = await swapLockMessage(staffId, staff?.name ?? "This person", dates, "duties", ["APPROVED"]);
    if (message) return message;
  }
  return null;
}

/** Removes Tasks from a person on days they have full-day leave (spec 9). */
async function clearTasksForFullDayLeave(staffId: string, dates: string[], halfDay: boolean) {
  if (halfDay) return;
  await db.taskAssignment.deleteMany({ where: { staffId, date: { in: dates } } });
}

/** One type of leave per person per day: returns an error message if any date already has leave. */
async function leaveClashMessage(staffId: string, who: string, dates: string[], excludeId?: string): Promise<string | null> {
  const clash = await findLeaveConflict(staffId, dates, excludeId);
  if (!clash) return null;
  const state = clash.status === "PENDING" ? "a pending request for" : "";
  return `${who} already ${who === "You" ? "have" : "has"} ${state} ${clash.code} on ${formatDate(clash.date)}. Only one type of leave is allowed per day.`.replace(/\s+/g, " ");
}

// ---------- Session ----------

export async function login(formData: FormData) {
  const staffId = formData.get("staffId");
  if (typeof staffId !== "string") return;
  const staff = await db.staff.findUnique({ where: { id: staffId } });
  if (!staff || !staff.active) return;
  await startSession(staff.id);
  redirect("/roster");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

// ---------- Leave requests (staff) ----------

export async function requestLeave(input: { typeCode: string; dates: string[]; half?: string | null; notes?: string }): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canRequestLeave(viewer)) return fail("Management does not request leave.");
  const dates = cleanDates(input.dates);
  if (!dates) return fail("Pick at least one valid date.");
  const type = await leaveTypeOrNull(input.typeCode);
  if (!type) return fail("Pick a leave type.");
  const half = halfFor(type.halfDay, input.half);
  if (half === "invalid") return fail("Choose first half or second half.");

  if (!canRequestOnLockedDate(viewer)) {
    const locked = await db.lockedDate.findFirst({ where: { shiftId: viewer.shiftId!, date: { in: dates } } });
    if (locked) return fail(`${formatDate(locked.date)} is a locked date: ${locked.remarks}`);
  }
  const clash = await leaveClashMessage(viewer.id, "You", dates);
  if (clash) return fail(clash);
  const swapped = await swapLockMessage(viewer.id, "You", dates, "leave");
  if (swapped) return fail(swapped);

  await db.leave.create({
    data: {
      staffId: viewer.id,
      typeCode: type.code,
      half,
      status: "PENDING",
      notes: cleanText(input.notes),
      days: { create: dates.map((date) => ({ date })) },
    },
  });
  return done("Request submitted. It is pending review.");
}

export async function withdrawLeave(leaveId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  const leave = await db.leave.findUnique({ where: { id: leaveId } });
  if (!leave || leave.staffId !== viewer.id) return fail("Request not found.");
  if (leave.status !== "PENDING") return fail("Only pending requests can be withdrawn.");
  await db.leave.update({ where: { id: leaveId }, data: { status: "WITHDRAWN" } });
  return done("Request withdrawn.");
}

// ---------- Review (supervisor / management) ----------

async function loadLeaveForDecision(viewer: Viewer, leaveId: string) {
  const leave = await db.leave.findUnique({ where: { id: leaveId }, include: { staff: true, type: true, days: true } });
  if (!leave) return null;
  if (!canDecideLeave(viewer, leave.staffId, leave.staff.shiftId)) return null;
  return leave;
}

export async function approveLeave(leaveId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  const leave = await loadLeaveForDecision(viewer, leaveId);
  if (!leave) return fail("You cannot review this request.");
  if (leave.status !== "PENDING") return fail("Only pending requests can be approved.");
  const dates = leave.days.map((d) => d.date);
  const noSlot = await datesWithoutSlot(leave.staff.shiftId!, dates, leave.type.halfDay ? 0.5 : 1);
  if (noSlot.length) return fail(`No slot available on ${formatDate(noSlot[0].date)} (${formatFigure(noSlot[0].slots)} left).`);

  await db.leave.update({
    where: { id: leaveId },
    data: { status: "APPROVED", decidedById: viewer.id, decidedAt: new Date() },
  });
  await clearTasksForFullDayLeave(leave.staffId, dates, leave.type.halfDay);
  return done("Leave approved.");
}

export async function rejectLeave(leaveId: string, reason: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  const leave = await loadLeaveForDecision(viewer, leaveId);
  if (!leave) return fail("You cannot review this request.");
  if (leave.status !== "PENDING") return fail("Only pending requests can be rejected.");
  const why = cleanText(reason);
  if (!why) return fail("A reason is required to reject.");
  await db.leave.update({
    where: { id: leaveId },
    data: { status: "REJECTED", rejectReason: why, decidedById: viewer.id, decidedAt: new Date() },
  });
  return done("Request rejected.");
}

// ---------- Leave given / edited by supervisors ----------

export async function giveLeave(input: {
  staffDates: Record<string, string[]>;
  typeCode: string;
  half?: string | null;
  remarks?: string;
}): Promise<ActionResult> {
  const viewer = await requireViewer();
  const type = await leaveTypeOrNull(input.typeCode);
  if (!type) return fail("Pick a leave type.");
  const half = halfFor(type.halfDay, input.half);
  if (half === "invalid") return fail("Choose first half or second half.");
  const entries = Object.entries(input.staffDates ?? {});
  if (entries.length === 0) return fail("Select staff and dates on the roster first.");

  const plan: { staffId: string; dates: string[] }[] = [];
  for (const [staffId, rawDates] of entries) {
    const dates = cleanDates(rawDates);
    if (!dates) return fail("Invalid dates selected.");
    const staff = await db.staff.findUnique({ where: { id: staffId } });
    if (!staff || !canEditShift(viewer, staff.shiftId)) return fail("You can only give leave in your own shift.");
    if (staff.role === "MANAGEMENT") return fail("Management does not take leave.");
    const clash = await leaveClashMessage(staffId, staffId === viewer.id ? "You" : staff.name, dates);
    if (clash) return fail(clash);
    const swapped = await swapLockMessage(staffId, staffId === viewer.id ? "You" : staff.name, dates, "leave");
    if (swapped) return fail(swapped);
    plan.push({ staffId, dates });
  }

  // TODO(open item): whether the "extra slot needed" rule also applies to leave given directly.
  // Locked dates and Off days are allowed here by spec.
  for (const { staffId, dates } of plan) {
    await db.leave.create({
      data: {
        staffId,
        typeCode: type.code,
        half,
        status: "APPROVED",
        remarks: cleanText(input.remarks),
        givenById: viewer.id,
        decidedById: viewer.id,
        decidedAt: new Date(),
        days: { create: dates.map((date) => ({ date })) },
      },
    });
    await clearTasksForFullDayLeave(staffId, dates, type.halfDay);
  }
  return done(plan.length === 1 ? "Leave given (already approved)." : `Leave given to ${plan.length} people (already approved).`);
}

export async function editLeave(input: {
  leaveId: string;
  typeCode: string;
  half?: string | null;
  remarks?: string;
  dates?: string[];
}): Promise<ActionResult> {
  const viewer = await requireViewer();
  const leave = await db.leave.findUnique({ where: { id: input.leaveId }, include: { staff: true, days: true } });
  if (!leave || !canEditShift(viewer, leave.staff.shiftId)) return fail("You cannot edit this leave.");
  if (leave.status !== "APPROVED" && leave.status !== "PENDING") return fail("This leave can no longer be edited.");
  const type = await leaveTypeOrNull(input.typeCode);
  if (!type) return fail("Pick a leave type.");
  if (leave.autoFor && (type.code !== leave.typeCode || input.dates)) {
    // The 0.5 OIL that comes with a DOS/FDO duty is fixed to its type and date: only the half moves.
    return fail(`This ${DOS_OIL_CODE} comes with the ${DOS_LABEL} duty. You can change which half, but not its type or date.`);
  }
  const half = halfFor(type.halfDay, input.half);
  if (half === "invalid") return fail("Choose first half or second half.");

  let dates = leave.days.map((d) => d.date);
  if (input.dates) {
    const next = cleanDates(input.dates);
    if (!next) return fail("Invalid dates.");
    const clash = await leaveClashMessage(leave.staffId, leave.staff.name, next, leave.id);
    if (clash) return fail(clash);
    const added = next.filter((d) => !leave.days.some((x) => x.date === d));
    const swapped = await swapLockMessage(leave.staffId, leave.staff.name, added, "leave");
    if (swapped) return fail(swapped);
    dates = next;
  }

  // TODO(open item): whether edits must pass the "extra slot needed" rule.
  await db.$transaction([
    db.leaveDay.deleteMany({ where: { leaveId: leave.id } }),
    db.leave.update({
      where: { id: leave.id },
      data: {
        typeCode: type.code,
        half,
        remarks: cleanText(input.remarks),
        days: { create: dates.map((date) => ({ date })) },
      },
    }),
  ]);
  if (leave.status === "APPROVED") await clearTasksForFullDayLeave(leave.staffId, dates, type.halfDay);
  return done("Leave updated.");
}

export async function cancelLeave(leaveId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  const leave = await db.leave.findUnique({ where: { id: leaveId }, include: { staff: true } });
  if (!leave || !canEditShift(viewer, leave.staff.shiftId)) return fail("Only supervisors and Management can cancel approved leave.");
  if (leave.autoFor) return fail(`This ${DOS_OIL_CODE} comes with the ${DOS_LABEL} duty and cannot be cancelled. Remove the duty instead.`);
  if (leave.status !== "APPROVED" && leave.status !== "PENDING") return fail("This leave has already been cancelled, rejected or withdrawn.");
  await db.leave.update({ where: { id: leaveId }, data: { status: "CANCELLED", decidedById: viewer.id, decidedAt: new Date() } });
  return done(leave.status === "PENDING" ? "Request cancelled." : "Leave cancelled. The slot is free again.");
}

// ---------- Duties and Tasks ----------

type CellRef = { staffId: string; date: string };

async function checkCells(viewer: Viewer, cells: CellRef[]): Promise<string | null> {
  if (!Array.isArray(cells) || cells.length === 0) return "Select cells on the roster first.";
  if (cells.length > 2000) return "Too many cells selected.";
  if (!cells.every((c) => typeof c.staffId === "string" && isValidDate(c.date))) return "Invalid selection.";
  const ids = [...new Set(cells.map((c) => c.staffId))];
  const staff = await db.staff.findMany({ where: { id: { in: ids } } });
  if (staff.length !== ids.length) return "Staff not found.";
  if (staff.some((s) => !canEditShift(viewer, s.shiftId))) return "You can only edit your own shift.";
  return null;
}

/**
 * Assigns V, V(SB) or Off(V). AM and PM are never set by hand: they come from the cycle.
 * duty "CYCLE" removes the override, so cancelling a V duty also restores the PM block that the
 * app had turned into Off(V).
 */
export async function assignDuty(input: { cells: CellRef[]; duty: string }): Promise<ActionResult> {
  const viewer = await requireViewer();
  const error = await checkCells(viewer, input.cells);
  if (error) return fail(error);
  const isCycle = input.duty === "CYCLE";
  if (!isCycle && !(ASSIGNABLE_DUTIES as readonly string[]).includes(input.duty)) {
    return fail("Pick V, V(SB) or Off(V). AM and PM follow the shift cycle.");
  }

  if (!isCycle) {
    const onLeave = await firstCellOnLeave(input.cells);
    if (onLeave) return fail(onLeave);
  }
  const swapped = await firstCellSwapped(input.cells);
  if (swapped) return fail(swapped);

  await db.$transaction(
    input.cells.map(({ staffId, date }) =>
      isCycle
        ? db.dutyOverride.deleteMany({ where: { staffId, date } })
        : db.dutyOverride.upsert({
            where: { staffId_date: { staffId, date } },
            create: { staffId, date, duty: input.duty },
            update: { duty: input.duty },
          }),
    ),
  );
  return done(isCycle ? "Reset to the normal cycle." : "Duty assigned.");
}

/**
 * DOS / DOS2IC / FDO (spec 5.2): a 24-hour duty reporting at 0800 on one AM day, on top of the
 * person's shift duty. It always earns a 0.5 OIL (first half) the next day, which is created here
 * and cannot be cancelled on its own. `kind` null removes the duty and that OIL.
 */
export async function assignExtraDuty(input: { cells: CellRef[]; kind: string | null }): Promise<ActionResult> {
  const viewer = await requireViewer();
  const error = await checkCells(viewer, input.cells);
  if (error) return fail(error);
  const swapped = await firstCellSwapped(input.cells);
  if (swapped) return fail(swapped);

  if (input.kind === null) {
    const removed = await db.extraDuty.findMany({ where: { OR: input.cells.map(({ staffId, date }) => ({ staffId, date })) } });
    if (removed.length === 0) return fail(`No ${DOS_LABEL} duty on the selected cells.`);
    await db.leave.deleteMany({ where: { autoFor: { in: removed.map((r) => r.id) } } });
    await db.extraDuty.deleteMany({ where: { id: { in: removed.map((r) => r.id) } } });
    return done(`${DOS_LABEL} duty removed, with its ${DOS_OIL_CODE}.`);
  }
  if (!(DOS_KINDS as readonly string[]).includes(input.kind)) return fail(`Pick ${DOS_KINDS.join(", ")}.`);
  const onLeave = await firstCellOnLeave(input.cells);
  if (onLeave) return fail(onLeave);

  // It must fall on an AM day, and the next day must be free for the 0.5 OIL.
  const staff = await db.staff.findMany({ where: { id: { in: input.cells.map((c) => c.staffId) } }, include: { shift: true } });
  const byId = new Map(staff.map((s) => [s.id, s]));
  for (const { staffId, date } of input.cells) {
    const person = byId.get(staffId)!;
    const roster = await buildRoster(person.shiftId!, date, date, viewer);
    const duty = roster.cells[staffId]?.[date]?.duty;
    if (duty !== "AM") return fail(`${person.name} is not on AM duty on ${formatDate(date)}. A ${DOS_LABEL} duty must fall on an AM day.`);
    // Only a 1st AM duty earns the next-day 0.5 OIL; after a 2nd AM the person is already Off.
    if (dosEarnsOil(person.shift!.cycleAnchor, date)) {
      const clash = await findLeaveConflict(staffId, [addDays(date, 1)]);
      if (clash) {
        return fail(`${person.name} already has ${clash.code} on ${formatDate(addDays(date, 1))}, so the ${DOS_OIL_CODE} that comes with this duty cannot be added.`);
      }
    }
  }

  let withOil = 0;
  for (const { staffId, date } of input.cells) {
    const existing = await db.extraDuty.findUnique({ where: { staffId_date: { staffId, date } } });
    if (existing) await db.leave.deleteMany({ where: { autoFor: existing.id } });
    const duty = await db.extraDuty.upsert({
      where: { staffId_date: { staffId, date } },
      create: { staffId, date, kind: input.kind },
      update: { kind: input.kind },
    });
    if (!dosEarnsOil(byId.get(staffId)!.shift!.cycleAnchor, date)) continue;
    withOil++;
    await createDosOil(duty, viewer.id);
  }
  return done(
    withOil === input.cells.length
      ? `${input.kind} assigned, with ${DOS_OIL_CODE} the next day.`
      : withOil === 0
        ? `${input.kind} assigned. No ${DOS_OIL_CODE}: a 2nd AM duty is followed by an Off day.`
        : `${input.kind} assigned. ${withOil} of ${input.cells.length} earned the ${DOS_OIL_CODE} (only a 1st AM duty does).`,
  );
}

// ---------- Locked dates and special events ----------

async function editableShifts(viewer: Viewer, shiftId: string, allShifts: boolean): Promise<string[] | null> {
  const ids = allShifts ? (await db.shift.findMany({ select: { id: true } })).map((s) => s.id) : [shiftId];
  if (ids.some((id) => !canEditShift(viewer, id))) return null;
  return ids;
}

/** Locks dates for events. Staff cannot request leave on them; supervisors still can give leave. */
export async function lockDates(input: { shiftId: string; dates: string[]; remarks: string; allShifts?: boolean }): Promise<ActionResult> {
  const viewer = await requireViewer();
  const dates = cleanDates(input.dates);
  if (!dates) return fail("Pick at least one valid date.");
  const remarks = cleanText(input.remarks);
  if (!remarks) return fail("Add remarks explaining why the dates are locked.");
  const shifts = await editableShifts(viewer, input.shiftId, input.allShifts === true);
  if (!shifts) return fail("You can only lock dates for your own shift.");

  for (const shiftId of shifts) {
    for (const date of dates) {
      await db.lockedDate.upsert({
        where: { shiftId_date: { shiftId, date } },
        create: { shiftId, date, remarks },
        update: { remarks },
      });
    }
  }
  return done(shifts.length > 1 ? `Locked on all ${shifts.length} shifts.` : "Date locked.");
}

export async function unlockDate(input: { shiftId: string; date: string; allShifts?: boolean }): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!isValidDate(input.date)) return fail("Invalid date.");
  const shifts = await editableShifts(viewer, input.shiftId, input.allShifts === true);
  if (!shifts) return fail("You can only unlock dates for your own shift.");
  await db.lockedDate.deleteMany({ where: { shiftId: { in: shifts }, date: input.date } });
  return done("Date unlocked. Leave already approved is unaffected.");
}

/** A whole shift reports at a different time. Does not change MFL or slots. */
export async function setSpecialEvent(input: { shiftId: string; date: string; note?: string }): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!isValidDate(input.date)) return fail("Invalid date.");
  if (!canEditShift(viewer, input.shiftId)) return fail("You can only set events for your own shift.");
  const note = cleanText(input.note);
  if (!note) return fail("Add a note saying what the event is.");

  await db.specialEvent.upsert({
    where: { shiftId_date: { shiftId: input.shiftId, date: input.date } },
    create: { shiftId: input.shiftId, date: input.date, note },
    update: { note },
  });
  return done("Special event set.");
}

export async function clearSpecialEvent(input: { shiftId: string; date: string }): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canEditShift(viewer, input.shiftId)) return fail("You can only change events for your own shift.");
  await db.specialEvent.deleteMany({ where: { shiftId: input.shiftId, date: input.date } });
  return done("Special event removed.");
}

/** taskId null removes the Task. People on full-day leave are skipped. */
export async function assignTask(input: { cells: CellRef[]; taskId: string | null }): Promise<ActionResult> {
  const viewer = await requireViewer();
  const error = await checkCells(viewer, input.cells);
  if (error) return fail(error);

  if (input.taskId === null) {
    await db.$transaction(input.cells.map(({ staffId, date }) => db.taskAssignment.deleteMany({ where: { staffId, date } })));
    return done("Task removed.");
  }
  const task = await db.task.findUnique({ where: { id: input.taskId } });
  if (!task) return fail("Task not found.");

  // Find full-day leave (including derived BD / BD-IL) from the roster itself.
  const byShift = new Map<string, CellRef[]>();
  const staff = await db.staff.findMany({ where: { id: { in: input.cells.map((c) => c.staffId) } } });
  const shiftOf = new Map(staff.map((s) => [s.id, s.shiftId!]));
  for (const c of input.cells) {
    const list = byShift.get(shiftOf.get(c.staffId)!) ?? [];
    list.push(c);
    byShift.set(shiftOf.get(c.staffId)!, list);
  }
  const allowed: CellRef[] = [];
  for (const [shiftId, cells] of byShift) {
    const dates = cells.map((c) => c.date).sort();
    const roster = await buildRoster(shiftId, dates[0], dates[dates.length - 1], viewer);
    for (const c of cells) {
      const onFullLeave = roster.cells[c.staffId]?.[c.date]?.absences.some((a) => a.status === "APPROVED" && a.counts >= 1);
      if (!onFullLeave) allowed.push(c);
    }
  }

  await db.$transaction(
    allowed.map(({ staffId, date }) =>
      db.taskAssignment.upsert({
        where: { staffId_date: { staffId, date } },
        create: { staffId, date, taskId: task.id },
        update: { taskId: task.id },
      }),
    ),
  );
  const skipped = input.cells.length - allowed.length;
  return done(skipped ? `${task.name} assigned. Skipped ${skipped} on full-day leave.` : `${task.name} assigned.`);
}

// ---------- Task management (Management only) ----------

function cleanTaskName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const t = name.replace(/\s+/g, " ").trim();
  return t.length > 0 && t.length <= NAME_MAX ? t : null;
}

export async function createTask(name: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManageTasks(viewer)) return fail("Only Management can manage Tasks.");
  const clean = cleanTaskName(name);
  if (!clean) return fail(`Name must be 1-${NAME_MAX} characters, spaces included.`);
  await db.task.create({ data: { name: clean } });
  return done(`${clean} added.`);
}

export async function renameTask(id: string, name: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManageTasks(viewer)) return fail("Only Management can manage Tasks.");
  const clean = cleanTaskName(name);
  if (!clean) return fail(`Name must be 1-${NAME_MAX} characters, spaces included.`);
  await db.task.update({ where: { id }, data: { name: clean } });
  return done("Task renamed.");
}

export async function deleteTask(id: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManageTasks(viewer)) return fail("Only Management can manage Tasks.");
  const task = await db.task.findUnique({ where: { id } });
  if (!task) return fail("Task not found.");
  await db.task.delete({ where: { id } }); // assignments cascade
  return done(`${task.name} and all its assignments deleted.`);
}

// ---------- Dayworkers (supervisors and Management) ----------

export async function createDayworker(input: { name: string; username: string }): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManageDayworkers(viewer)) return fail("Only supervisors and Management can add dayworkers.");
  const name = normalizeDayworkerName(input.name);
  if (!name) return fail("Enter the dayworker's name.");
  const username = normalizeUsername(input.username);
  if (!username.ok) return fail(username.error);
  if (await db.dayworker.findUnique({ where: { username: username.username } })) {
    return fail(`The username ${username.username} is already taken.`);
  }
  await db.dayworker.create({ data: { name, username: username.username } });
  return done(`${username.username} added.`);
}

export async function updateDayworker(input: { id: string; name: string; username: string }): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManageDayworkers(viewer)) return fail("Only supervisors and Management can edit dayworkers.");
  const existing = await db.dayworker.findUnique({ where: { id: input.id } });
  if (!existing) return fail("Dayworker not found.");
  const name = normalizeDayworkerName(input.name);
  if (!name) return fail("Enter the dayworker's name.");
  const username = normalizeUsername(input.username);
  if (!username.ok) return fail(username.error);
  const taken = await db.dayworker.findUnique({ where: { username: username.username } });
  if (taken && taken.id !== existing.id) return fail(`The username ${username.username} is already taken.`);
  await db.dayworker.update({ where: { id: existing.id }, data: { name, username: username.username } });
  return done("Dayworker updated.");
}

/** Dayworkers are never deleted: the duty history behind the report is kept. */
export async function setDayworkerActive(id: string, active: boolean): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManageDayworkers(viewer)) return fail("Only supervisors and Management can change dayworkers.");
  const existing = await db.dayworker.findUnique({ where: { id } });
  if (!existing) return fail("Dayworker not found.");
  await db.dayworker.update({ where: { id }, data: { active } });
  return done(active ? `${existing.username} is active again.` : `${existing.username} deactivated. Past duty stays in the report.`);
}

// ---------- Ops duty: dayworkers clocking shift duty (spec 5.3) ----------

function cleanIds(ids: unknown, max = 60): string[] | null {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > max) return null;
  if (!ids.every((id) => typeof id === "string")) return null;
  return [...new Set(ids as string[])];
}

async function shiftOrNull(shiftId: unknown) {
  return typeof shiftId === "string" ? db.shift.findUnique({ where: { id: shiftId } }) : null;
}

export async function assignOpsDuty(input: { shiftId: string; dates: string[]; dayworkerIds: string[] }): Promise<ActionResult> {
  const viewer = await requireViewer();
  const shift = await shiftOrNull(input.shiftId);
  if (!shift) return fail("Shift not found.");
  if (!canEditShift(viewer, shift.id)) return fail("You can only assign Ops duty for your own shift.");
  const dates = cleanDates(input.dates);
  if (!dates) return fail("Pick at least one valid date.");
  const ids = cleanIds(input.dayworkerIds);
  if (!ids) return fail("Pick at least one dayworker.");

  const dayworkers = await db.dayworker.findMany({ where: { id: { in: ids } } });
  if (dayworkers.length !== ids.length) return fail("Dayworker not found.");
  const inactive = dayworkers.find((d) => !d.active);
  if (inactive) return fail(`${inactive.username} is inactive. Reactivate them first.`);

  // A dayworker clocks one shift per day.
  const clash = await db.opsDuty.findFirst({
    where: { dayworkerId: { in: ids }, date: { in: dates }, shiftId: { not: shift.id } },
    include: { dayworker: true },
    orderBy: { date: "asc" },
  });
  if (clash) return fail(`${clash.dayworker.username} is already on Ops duty for Shift ${clash.shiftId} on ${formatDate(clash.date)}.`);

  await db.$transaction(
    ids.flatMap((dayworkerId) =>
      dates.map((date) =>
        db.opsDuty.upsert({
          where: { dayworkerId_date: { dayworkerId, date } },
          create: { dayworkerId, shiftId: shift.id, date },
          update: {},
        }),
      ),
    ),
  );
  const names = dayworkers.map((d) => d.username).join(", ");
  return done(`${names} on Ops duty for ${dates.length} day${dates.length > 1 ? "s" : ""}.`);
}

export async function removeOpsDuty(input: { shiftId: string; dates: string[]; dayworkerIds: string[] }): Promise<ActionResult> {
  const viewer = await requireViewer();
  const shift = await shiftOrNull(input.shiftId);
  if (!shift) return fail("Shift not found.");
  if (!canEditShift(viewer, shift.id)) return fail("You can only change Ops duty for your own shift.");
  const dates = cleanDates(input.dates);
  const ids = cleanIds(input.dayworkerIds);
  if (!dates || !ids) return fail("Nothing selected.");
  const { count } = await db.opsDuty.deleteMany({ where: { shiftId: shift.id, date: { in: dates }, dayworkerId: { in: ids } } });
  return done(count === 0 ? "Nothing to remove." : `Removed ${count} Ops duty day${count > 1 ? "s" : ""}.`);
}

// ---------- Extra shift duty: serving extra duty on another shift (spec 5.4) ----------

export async function assignExtraShift(input: { hostShiftId: string; dates: string[]; staffIds: string[] }): Promise<ActionResult> {
  const viewer = await requireViewer();
  const host = await shiftOrNull(input.hostShiftId);
  if (!host) return fail("Shift not found.");
  if (!canEditShift(viewer, host.id)) return fail("You can only assign Extra duty for your own shift.");
  const dates = cleanDates(input.dates);
  if (!dates) return fail("Pick at least one valid date.");
  const ids = cleanIds(input.staffIds);
  if (!ids) return fail("Pick at least one person.");

  const people = await db.staff.findMany({ where: { id: { in: ids } } });
  if (people.length !== ids.length) return fail("Staff not found.");
  for (const person of people) {
    if (!person.active || person.role === "MANAGEMENT" || !person.shiftId) return fail(`${person.name} cannot serve Extra duty.`);
    // Extra duty can only come from other shifts.
    if (person.shiftId === host.id) return fail(`${person.name} is in ${host.name}. Extra duty comes from the other shifts.`);
  }

  // Not on a day they are on leave, and only one host shift per day.
  const onLeave = await firstCellOnLeave(ids.flatMap((staffId) => dates.map((date) => ({ staffId, date }))));
  if (onLeave) return fail(onLeave);
  const clash = await db.extraShiftDuty.findFirst({
    where: { staffId: { in: ids }, date: { in: dates }, hostShiftId: { not: host.id } },
    include: { staff: true },
    orderBy: { date: "asc" },
  });
  if (clash) return fail(`${clash.staff.name} is already on Extra duty for Shift ${clash.hostShiftId} on ${formatDate(clash.date)}.`);

  await db.$transaction(
    ids.flatMap((staffId) =>
      dates.map((date) =>
        db.extraShiftDuty.upsert({
          where: { staffId_date: { staffId, date } },
          create: { staffId, hostShiftId: host.id, date },
          update: {},
        }),
      ),
    ),
  );
  return done(`${people.map((p) => p.name).join(", ")} on Extra duty for ${dates.length} day${dates.length > 1 ? "s" : ""}.`);
}

export async function removeExtraShift(input: { hostShiftId: string; dates: string[]; staffIds: string[] }): Promise<ActionResult> {
  const viewer = await requireViewer();
  const host = await shiftOrNull(input.hostShiftId);
  if (!host) return fail("Shift not found.");
  if (!canEditShift(viewer, host.id)) return fail("You can only change Extra duty for your own shift.");
  const dates = cleanDates(input.dates);
  const ids = cleanIds(input.staffIds);
  if (!dates || !ids) return fail("Nothing selected.");
  const { count } = await db.extraShiftDuty.deleteMany({ where: { hostShiftId: host.id, date: { in: dates }, staffId: { in: ids } } });
  return done(count === 0 ? "Nothing to remove." : `Removed ${count} Extra duty day${count > 1 ? "s" : ""}.`);
}
