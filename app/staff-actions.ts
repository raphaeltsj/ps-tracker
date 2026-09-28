"use server";
// Staff records: supervisors manage their own shift, Management manages any shift. Deactivating
// (never deleting) keeps a person's leave, duty and Task history intact, like Dayworkers.
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions";
import { requireViewer } from "@/lib/auth";
import { isValidDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { canManageStaff } from "@/lib/permissions";
import { isStaffRole, normalizeStaffName } from "@/lib/staff";

const SHIFT_IDS = ["A", "B", "C"];
const fail = (error: string): ActionResult => ({ ok: false, error });

function done(message?: string): ActionResult {
  revalidatePath("/", "layout");
  return { ok: true, message };
}

function cleanBirthday(input: unknown): string | null {
  return typeof input === "string" && isValidDate(input) ? input : null;
}

export async function createStaff(input: { name: string; shiftId: string; role: string; birthday?: string | null }): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!SHIFT_IDS.includes(input.shiftId)) return fail("Invalid shift.");
  if (!canManageStaff(viewer, input.shiftId)) return fail("You can only add staff to a shift you manage.");
  if (!isStaffRole(input.role)) return fail("Invalid role.");
  if (viewer.role === "SUPERVISOR" && input.role !== "STAFF") return fail("Only Management can add a supervisor.");
  const name = normalizeStaffName(input.name);
  if (!name) return fail("Enter the staff member's name.");
  await db.staff.create({ data: { name, shiftId: input.shiftId, role: input.role, birthday: cleanBirthday(input.birthday) } });
  return done(`${name} added to Shift ${input.shiftId}.`);
}

export async function updateStaff(input: { id: string; name: string; birthday?: string | null; shiftId?: string; role?: string }): Promise<ActionResult> {
  const viewer = await requireViewer();
  const existing = await db.staff.findUnique({ where: { id: input.id } });
  if (!existing) return fail("Staff member not found.");
  if (!canManageStaff(viewer, existing.shiftId)) return fail("You can only edit staff in a shift you manage.");
  const name = normalizeStaffName(input.name);
  if (!name) return fail("Enter the staff member's name.");

  const data: { name: string; birthday: string | null; shiftId?: string; role?: string } = { name, birthday: cleanBirthday(input.birthday) };
  if (viewer.role === "MANAGEMENT") {
    if (input.shiftId && input.shiftId !== existing.shiftId) {
      if (!SHIFT_IDS.includes(input.shiftId)) return fail("Invalid shift.");
      data.shiftId = input.shiftId;
    }
    if (input.role && input.role !== existing.role) {
      if (!isStaffRole(input.role)) return fail("Invalid role.");
      data.role = input.role;
    }
  }
  await db.staff.update({ where: { id: input.id }, data });
  return done(`${name} updated.`);
}

/** Never deleted: deactivating keeps their leave, duty and Task history for records and reporting. */
export async function setStaffActive(id: string, active: boolean): Promise<ActionResult> {
  const viewer = await requireViewer();
  const existing = await db.staff.findUnique({ where: { id } });
  if (!existing) return fail("Staff member not found.");
  if (!canManageStaff(viewer, existing.shiftId)) return fail("You can only change staff in a shift you manage.");
  if (!active && existing.id === viewer.id) return fail("You cannot deactivate your own account.");
  await db.staff.update({ where: { id }, data: { active } });
  return done(active ? `${existing.name} is active again.` : `${existing.name} deactivated. Their leave, duty and Task history is kept.`);
}

// ---------- Task proficiency: who is trained for which Task, kept by supervisors/Management only ----------

/**
 * Never shown to staff and never affects the roster: a record of who can do a Task, and who is
 * currently training for it ("(U/S)", an understudy). "NONE" removes the record entirely.
 */
export async function setStaffProficiency(input: { staffId: string; taskId: string; level: "NONE" | "PROFICIENT" | "UNDERSTUDY" }): Promise<ActionResult> {
  const viewer = await requireViewer();
  const staff = await db.staff.findUnique({ where: { id: input.staffId } });
  if (!staff) return fail("Staff member not found.");
  if (!canManageStaff(viewer, staff.shiftId)) return fail("You can only set proficiency for staff in a shift you manage.");
  const task = await db.task.findUnique({ where: { id: input.taskId } });
  if (!task) return fail("Task not found.");

  if (input.level === "NONE") {
    await db.staffTaskProficiency.deleteMany({ where: { staffId: input.staffId, taskId: input.taskId } });
    return done(`${staff.name}: ${task.name} marked not trained.`);
  }
  if (input.level !== "PROFICIENT" && input.level !== "UNDERSTUDY") return fail("Invalid level.");
  await db.staffTaskProficiency.upsert({
    where: { staffId_taskId: { staffId: input.staffId, taskId: input.taskId } },
    create: { staffId: input.staffId, taskId: input.taskId, understudy: input.level === "UNDERSTUDY" },
    update: { understudy: input.level === "UNDERSTUDY" },
  });
  return done(`${staff.name}: ${task.name} ${input.level === "UNDERSTUDY" ? "marked as understudy (U/S)." : "marked proficient."}`);
}
