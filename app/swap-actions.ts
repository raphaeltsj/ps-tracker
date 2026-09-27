"use server";
// Duty swaps (spec 11.4). Every action re-checks permissions and re-validates the swap: duties,
// leave and other swaps may have changed since it was requested.
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions";
import { requireViewer } from "@/lib/auth";
import { dosEarnsOil } from "@/lib/cycle";
import { addDays, isValidDate, todayLocal } from "@/lib/dates";
import { db } from "@/lib/db";
import { DOS_OIL_CODE } from "@/lib/domain";
import { createDosOil } from "@/lib/dos-oil";
import { findLeaveConflict } from "@/lib/leave-rules";
import { canEditShift, canRequestLeave, type Viewer } from "@/lib/permissions";
import { canApproveSide, checkSwap, findSwapClash, loadSwap, type SwapCheck } from "@/lib/swap-data";
import { PENDING_SWAP_STATUSES, SWAP_MAX_DATES } from "@/lib/swaps";

const fail = (error: string): ActionResult => ({ ok: false, error });

function done(message?: string): ActionResult {
  revalidatePath("/", "layout");
  return { ok: true, message };
}

function cleanSwapDates(dates: unknown): string[] | null {
  if (!Array.isArray(dates) || dates.length === 0 || dates.length > SWAP_MAX_DATES) return null;
  if (!dates.every((d) => typeof d === "string" && isValidDate(d))) return null;
  return [...new Set(dates as string[])].sort();
}

function cleanText(text: unknown, max = 500): string | null {
  if (typeof text !== "string") return null;
  const t = text.trim().slice(0, max);
  return t.length ? t : null;
}

/** Staff and supervisors request for themselves, and only for today onwards. */
function requestProblem(viewer: Viewer, dates: string[]): string | null {
  if (!canRequestLeave(viewer)) return "Management is not on a shift roster, so does not swap duties.";
  if (dates[0] < todayLocal()) return "Swap dates must be today or later.";
  return null;
}

/** Who may see a preview or record a swap for these two people. */
async function mayArrange(viewer: Viewer, aId: string, bId: string): Promise<boolean> {
  if (viewer.id === aId || viewer.id === bId) return true;
  const people = await db.staff.findMany({ where: { id: { in: [aId, bId] } } });
  return people.some((p) => canEditShift(viewer, p.shiftId));
}

/** Before/after for each date and the Off(V) knock-on, so the form can show the swap before submitting. */
export async function previewDutySwap(input: { aId: string; bId: string; dates: string[] }): Promise<SwapCheck> {
  const viewer = await requireViewer();
  const dates = cleanSwapDates(input.dates);
  if (!dates) return { ok: false, error: "Pick one date, or two for a give-and-take swap." };
  if (!(await mayArrange(viewer, input.aId, input.bId))) return { ok: false, error: "You can only arrange swaps for yourself or your own shift." };
  return checkSwap(input.aId, input.bId, dates);
}

/** A staff member (or supervisor, in Staff view) asks a partner to swap. The partner answers first. */
export async function requestSwap(input: { partnerId: string; dates: string[]; notes?: string }): Promise<ActionResult> {
  const viewer = await requireViewer();
  const dates = cleanSwapDates(input.dates);
  if (!dates) return fail("Pick one date, or two for a give-and-take swap.");
  const problem = requestProblem(viewer, dates);
  if (problem) return fail(problem);
  const check = await checkSwap(viewer.id, input.partnerId, dates);
  if (!check.ok) return fail(check.error);

  const partner = await db.staff.findUniqueOrThrow({ where: { id: input.partnerId } });
  await db.dutySwap.create({
    data: {
      requesterId: viewer.id,
      partnerId: partner.id,
      requesterShiftId: viewer.shiftId!,
      partnerShiftId: partner.shiftId!,
      status: "PENDING_PARTNER",
      notes: cleanText(input.notes),
      createdById: viewer.id,
      days: { create: dates.map((date) => ({ date })) },
    },
  });
  return done(`Swap request sent to ${partner.name} (${partner.shiftId}). Once they accept, it goes to the supervisors.`);
}

/**
 * A supervisor or Management records a swap directly. That counts as the partner's agreement and
 * approves every side the recorder supervises; a swap with another shift still needs that shift's
 * supervisor. Person A must be in a shift the recorder supervises.
 */
export async function recordSwap(input: { aId: string; bId: string; dates: string[]; notes?: string }): Promise<ActionResult> {
  const viewer = await requireViewer();
  const dates = cleanSwapDates(input.dates);
  if (!dates) return fail("Pick one date, or two for a give-and-take swap.");
  const people = await db.staff.findMany({ where: { id: { in: [input.aId, input.bId] } } });
  const a = people.find((p) => p.id === input.aId);
  const b = people.find((p) => p.id === input.bId);
  if (!a || !b) return fail("Staff not found.");
  if (!canEditShift(viewer, a.shiftId)) return fail("You can only record swaps for people in your own shift.");
  const check = await checkSwap(a.id, b.id, dates);
  if (!check.ok) return fail(check.error);

  const aSide = canApproveSide(viewer, a.shiftId!) ? viewer.id : null;
  const bSide = canApproveSide(viewer, b.shiftId!) ? viewer.id : null;
  const approved = Boolean(aSide && bSide);
  await db.dutySwap.create({
    data: {
      requesterId: a.id,
      partnerId: b.id,
      requesterShiftId: a.shiftId!,
      partnerShiftId: b.shiftId!,
      status: approved ? "APPROVED" : "PENDING_APPROVAL",
      notes: cleanText(input.notes),
      createdById: viewer.id,
      partnerRespondedAt: new Date(),
      requesterSideById: aSide,
      partnerSideById: bSide,
      decidedById: approved ? viewer.id : null,
      decidedAt: approved ? new Date() : null,
      days: { create: dates.map((date) => ({ date })) },
    },
  });
  if (!approved) return done(`Swap recorded. It now needs the Shift ${b.shiftId} supervisor's approval.`);
  const noOil = await dropDosOil([a.id, b.id], dates);
  return done(`Swap recorded and approved: ${a.name} (${a.shiftId}) and ${b.name} (${b.shiftId}) exchange duties.${oilNote(noOil)}`);
}

export async function respondSwap(swapId: string, accept: boolean): Promise<ActionResult> {
  const viewer = await requireViewer();
  const swap = await loadSwap(swapId);
  if (!swap || swap.partnerId !== viewer.id) return fail("Swap request not found.");
  if (swap.status !== "PENDING_PARTNER") return fail("This request is no longer waiting for your answer.");
  if (!accept) {
    await db.dutySwap.update({ where: { id: swapId }, data: { status: "DECLINED", partnerRespondedAt: new Date() } });
    return done("Swap declined.");
  }
  const check = await checkSwap(swap.requesterId, swap.partnerId, swap.days.map((d) => d.date), swap.id);
  if (!check.ok) return fail(check.error);
  await db.dutySwap.update({ where: { id: swapId }, data: { status: "PENDING_APPROVAL", partnerRespondedAt: new Date() } });
  return done("Swap accepted. It now goes to the supervisors for approval.");
}

/** The requester can withdraw until the swap is approved. */
export async function withdrawSwap(swapId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  const swap = await loadSwap(swapId);
  if (!swap || swap.requesterId !== viewer.id || swap.createdById !== viewer.id) return fail("Swap request not found.");
  if (!(PENDING_SWAP_STATUSES as string[]).includes(swap.status)) return fail("Only pending swaps can be withdrawn. Ask a supervisor to cancel an approved swap.");
  await db.dutySwap.update({ where: { id: swapId }, data: { status: "WITHDRAWN" } });
  return done("Swap request withdrawn.");
}

/** Approves every side of the swap the viewer supervises. When both sides are approved it takes effect. */
export async function approveSwap(swapId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  const swap = await loadSwap(swapId);
  if (!swap) return fail("Swap not found.");
  if (swap.status !== "PENDING_APPROVAL") return fail(swap.status === "PENDING_PARTNER" ? `${swap.partner.name} has not accepted this swap yet.` : "This swap is not waiting for approval.");
  const aSide = swap.requesterSideById ?? (canApproveSide(viewer, swap.requesterShiftId) ? viewer.id : null);
  const bSide = swap.partnerSideById ?? (canApproveSide(viewer, swap.partnerShiftId) ? viewer.id : null);
  if (aSide === swap.requesterSideById && bSide === swap.partnerSideById) return fail("There is no side of this swap left for you to approve.");

  const dates = swap.days.map((d) => d.date);
  const check = await checkSwap(swap.requesterId, swap.partnerId, dates, swap.id);
  if (!check.ok) return fail(check.error);

  const approved = Boolean(aSide && bSide);
  await db.dutySwap.update({
    where: { id: swapId },
    data: {
      requesterSideById: aSide,
      partnerSideById: bSide,
      status: approved ? "APPROVED" : "PENDING_APPROVAL",
      decidedById: approved ? viewer.id : null,
      decidedAt: approved ? new Date() : null,
    },
  });
  if (!approved) {
    const waiting = aSide ? swap.partnerShiftId : swap.requesterShiftId;
    return done(`Your side is approved. It now needs the Shift ${waiting} supervisor.`);
  }
  const noOil = await dropDosOil([swap.requesterId, swap.partnerId], dates);
  return done(
    `Swap approved. The roster now shows ${swap.requester.name} (${swap.requesterShiftId}) and ${swap.partner.name} (${swap.partnerShiftId}) on each other's duty.${oilNote(noOil)}`,
  );
}

export async function rejectSwap(swapId: string, reason: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  const swap = await loadSwap(swapId);
  if (!swap) return fail("Swap not found.");
  if (!canApproveSide(viewer, swap.requesterShiftId) && !canApproveSide(viewer, swap.partnerShiftId)) return fail("Only the supervisors of these shifts can reject this swap.");
  if (!(PENDING_SWAP_STATUSES as string[]).includes(swap.status)) return fail("Only pending swaps can be rejected.");
  const why = cleanText(reason);
  if (!why) return fail("A reason is required to reject.");
  await db.dutySwap.update({ where: { id: swapId }, data: { status: "REJECTED", rejectReason: why, decidedById: viewer.id, decidedAt: new Date() } });
  return done("Swap rejected.");
}

/** Supervisors of either shift (or Management) cancel an approved swap: both people's normal duties come back. */
export async function cancelSwap(swapId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  const swap = await loadSwap(swapId);
  if (!swap) return fail("Swap not found.");
  if (!canApproveSide(viewer, swap.requesterShiftId) && !canApproveSide(viewer, swap.partnerShiftId)) return fail("Only supervisors and Management can cancel an approved swap.");
  if (swap.status !== "APPROVED") return fail("Only approved swaps can be cancelled.");
  await db.dutySwap.update({ where: { id: swapId }, data: { status: "CANCELLED", decidedById: viewer.id, decidedAt: new Date() } });
  const restored = await restoreDosOil([swap.requesterId, swap.partnerId], swap.days.map((d) => d.date), viewer.id);
  return done(`Swap cancelled. Both people are back on their normal duties.${restored ? ` ${DOS_OIL_CODE} restored after ${restored} DOS/FDO duty.` : ""}`);
}

// ---------- DOS/FDO on a swapped date ----------
// The DOS/FDO duty stays with its holder, but a DOS on a swapped date earns no 0.5 OIL. Approving the
// swap removes that OIL; cancelling the swap brings it back (spec 5.2, 11.4).

async function dropDosOil(staffIds: string[], dates: string[]): Promise<number> {
  const duties = await db.extraDuty.findMany({ where: { staffId: { in: staffIds }, date: { in: dates } } });
  if (duties.length === 0) return 0;
  const { count } = await db.leave.deleteMany({ where: { autoFor: { in: duties.map((d) => d.id) } } });
  return count;
}

function oilNote(removed: number): string {
  return removed ? ` The ${DOS_OIL_CODE} after ${removed === 1 ? "a DOS/FDO duty" : `${removed} DOS/FDO duties`} on a swapped date was removed: no OIL on a swapped date.` : "";
}

async function restoreDosOil(staffIds: string[], dates: string[], byId: string): Promise<number> {
  const duties = await db.extraDuty.findMany({ where: { staffId: { in: staffIds }, date: { in: dates } }, include: { staff: { include: { shift: true } } } });
  let restored = 0;
  for (const duty of duties) {
    if (!duty.staff.shift || !dosEarnsOil(duty.staff.shift.cycleAnchor, duty.date)) continue;
    if (await db.leave.findFirst({ where: { autoFor: duty.id } })) continue;
    const next = addDays(duty.date, 1);
    // Skip if the next day now has other leave or is held by another swap.
    if (await findLeaveConflict(duty.staffId, [next])) continue;
    if (await findSwapClash([duty.staffId], [next])) continue;
    await createDosOil(duty, byId);
    restored++;
  }
  return restored;
}
