"use server";
// All mutations. Every action re-checks permissions with lib/permissions.ts: hiding a button in the
// UI is never the only protection.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { endSession, requireViewer, startSession } from "@/lib/auth";
import { formatDate, isValidDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { ASSIGNABLE_DUTIES, NAME_MAX, type Half } from "@/lib/domain";
import {
  canDecideLeave,
  canEditShift,
  canManageTasks,
  canRequestLeave,
  canRequestOnLockedDate,
  type Viewer,
} from "@/lib/permissions";
import { buildRoster } from "@/lib/roster-data";
import { findLeaveConflict } from "@/lib/leave-rules";
import { datesWithoutSlot } from "@/lib/slots";
import { formatFigure } from "@/lib/strength";

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
  const half = halfFor(type.halfDay, input.half);
  if (half === "invalid") return fail("Choose first half or second half.");

  let dates = leave.days.map((d) => d.date);
  if (input.dates) {
    const next = cleanDates(input.dates);
    if (!next) return fail("Invalid dates.");
    const clash = await leaveClashMessage(leave.staffId, leave.staff.name, next, leave.id);
    if (clash) return fail(clash);
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
  if (leave.status !== "APPROVED") return fail("Only approved leave can be cancelled.");
  await db.leave.update({ where: { id: leaveId }, data: { status: "CANCELLED", decidedById: viewer.id, decidedAt: new Date() } });
  return done("Leave cancelled. The slot is free again.");
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

/** duty "CYCLE" removes the override so the person follows the normal cycle again. */
export async function assignDuty(input: { cells: CellRef[]; duty: string }): Promise<ActionResult> {
  const viewer = await requireViewer();
  const error = await checkCells(viewer, input.cells);
  if (error) return fail(error);
  const isCycle = input.duty === "CYCLE";
  if (!isCycle && !(ASSIGNABLE_DUTIES as readonly string[]).includes(input.duty)) return fail("Pick a duty.");

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
