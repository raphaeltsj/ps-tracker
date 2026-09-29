"use server";
// OIL awards: supervisors (own shift) and Management (any shift) set how much OIL each person may take.
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions";
import { requireViewer } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyOilChange } from "@/lib/notifications";
import { getOilBalances } from "@/lib/oil";
import { canEditShift } from "@/lib/permissions";
import { formatFigure } from "@/lib/strength";

const fail = (error: string): ActionResult => ({ ok: false, error });
const STEPS = [0.5, 1, -0.5, -1];

function done(message: string): ActionResult {
  revalidatePath("/", "layout");
  return { ok: true, message };
}

/** Award (+) or take back (-) OIL for one person, in 0.5 or 1 day steps. Never below zero allowed. */
export async function adjustOil(staffId: string, amount: number): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!STEPS.includes(amount)) return fail("OIL changes in steps of 0.5 or 1.");
  const staff = await db.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.role === "MANAGEMENT" || !canEditShift(viewer, staff.shiftId)) return fail("You can only award OIL on a shift you manage.");
  const before = (await getOilBalances([staffId]))[staffId];
  if (before.allowed + amount < 0) return fail(`${staff.name} has ${formatFigure(before.allowed)} OIL allowed, so it can't go lower.`);

  await db.oilGrant.create({ data: { staffId, amount, byId: viewer.id } });
  const left = before.left + amount;
  await notifyOilChange([{ staffId, left }], viewer.id, viewer.name, amount);
  return done(`${staff.name}: ${amount > 0 ? "+" : "-"}${formatFigure(Math.abs(amount))} OIL. Can now take ${formatFigure(left)}.`);
}

/** Give every active person on a shift the same OIL award (1 or 0.5), e.g. for a public holiday. */
export async function giveOilToShift(shiftId: string, amount: number): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (amount !== 1 && amount !== 0.5) return fail("Give everyone 1 or 0.5 OIL.");
  if (!canEditShift(viewer, shiftId)) return fail("You can only award OIL on a shift you manage.");
  const staff = await db.staff.findMany({ where: { shiftId, active: true, role: { not: "MANAGEMENT" } }, select: { id: true } });
  if (staff.length === 0) return fail("No active staff on this shift.");

  await db.oilGrant.createMany({ data: staff.map((s) => ({ staffId: s.id, amount, byId: viewer.id })) });
  const balances = await getOilBalances(staff.map((s) => s.id));
  await notifyOilChange(
    staff.map((s) => ({ staffId: s.id, left: balances[s.id].left })),
    viewer.id,
    viewer.name,
    amount,
  );
  return done(`Gave ${formatFigure(amount)} OIL to all ${staff.length} active staff on Shift ${shiftId}. Each has been notified.`);
}
