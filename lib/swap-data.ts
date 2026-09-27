import "server-only";
import { addDays, dateRange, formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import type { AssignableDuty, Duty } from "@/lib/domain";
import { findLeaveConflict } from "@/lib/leave-rules";
import { canEditShift, type Viewer } from "@/lib/permissions";
import {
  ACTIVE_SWAP_STATUSES,
  dutiesDiffer,
  makeDutyResolver,
  PENDING_SWAP_STATUSES,
  previewSwap,
  type PersonCycle,
  type SwapDate,
  type SwapPreviewRow,
  type SwapRipple,
  type SwapStatus,
} from "@/lib/swaps";

// A V taken over in a swap earns Off(V) up to 6 days later, and post-V looks back 2 more days.
const LOOK_BACK = 8;

export type SwapPerson = { id: string; name: string; shiftId: string | null };

/**
 * Loads what makeDutyResolver needs for `staffIds` over [from, to]: approved swaps touching them
 * and the cycle of every partner, including partners from other shifts. `known` skips reloading
 * people the caller already has. `excludeSwapId` leaves one swap out (to preview or re-check it).
 */
export async function loadDutyContext(
  staffIds: string[],
  from: string,
  to: string,
  opts: { known?: Map<string, PersonCycle>; excludeSwapId?: string } = {},
) {
  const loadFrom = addDays(from, -LOOK_BACK);
  const swapDays = await db.dutySwapDay.findMany({
    where: {
      date: { gte: loadFrom, lte: to },
      swap: {
        status: "APPROVED",
        id: opts.excludeSwapId ? { not: opts.excludeSwapId } : undefined,
        OR: [{ requesterId: { in: staffIds } }, { partnerId: { in: staffIds } }],
      },
    },
    include: { swap: { select: { requesterId: true, partnerId: true } } },
  });
  const swaps: SwapDate[] = swapDays.map((d) => ({ swapId: d.swapId, date: d.date, a: d.swap.requesterId, b: d.swap.partnerId }));

  const people = new Map<string, PersonCycle>(opts.known);
  const needed = [...new Set([...staffIds, ...swaps.flatMap((s) => [s.a, s.b])])];
  const info = await db.staff.findMany({ where: { id: { in: needed } }, include: { shift: true } });
  const missing = info.filter((s) => !people.has(s.id));
  if (missing.length) {
    const overrides = await db.dutyOverride.findMany({ where: { staffId: { in: missing.map((s) => s.id) }, date: { gte: addDays(loadFrom, -LOOK_BACK), lte: to } } });
    for (const s of missing) {
      if (!s.shift) continue; // Management: no cycle, never in a swap
      const map = new Map<string, AssignableDuty>();
      for (const o of overrides) if (o.staffId === s.id) map.set(o.date, o.duty as AssignableDuty);
      people.set(s.id, { anchor: s.shift.cycleAnchor, overrides: map });
    }
  }
  const byId = new Map<string, SwapPerson>(info.map((s) => [s.id, { id: s.id, name: s.name, shiftId: s.shiftId }]));
  return { people, swaps, byId, resolve: makeDutyResolver(people, swaps) };
}

// ---------- Validation ----------

/** Another active swap holding one of the dates for one of these people, if any. */
export async function findSwapClash(staffIds: string[], dates: string[], excludeSwapId?: string, statuses: SwapStatus[] = ACTIVE_SWAP_STATUSES) {
  return db.dutySwapDay.findFirst({
    where: {
      date: { in: dates },
      swap: {
        status: { in: statuses },
        id: excludeSwapId ? { not: excludeSwapId } : undefined,
        OR: [{ requesterId: { in: staffIds } }, { partnerId: { in: staffIds } }],
      },
    },
    include: { swap: { include: { requester: true, partner: true } } },
    orderBy: { date: "asc" },
  });
}

/** Message for dates a person cannot change because a swap holds them, or null. */
export async function swapLockMessage(staffId: string, who: string, dates: string[], what: string, statuses: SwapStatus[] = ACTIVE_SWAP_STATUSES): Promise<string | null> {
  if (dates.length === 0) return null;
  const clash = await findSwapClash([staffId], dates, undefined, statuses);
  if (!clash) return null;
  const other = clash.swap.requesterId === staffId ? clash.swap.partner : clash.swap.requester;
  const state = clash.swap.status === "APPROVED" ? "an approved" : "a pending";
  return `${who} ${who === "You" ? "have" : "has"} ${state} duty swap with ${other.name} on ${formatDate(clash.date)}, so ${what} cannot change that day. Cancel the swap first.`;
}

export type SwapCheck =
  | { ok: true; rows: SwapPreviewRow[]; ripples: SwapRipple[]; names: Record<string, string> }
  | { ok: false; error: string };

/**
 * Checks a proposed swap between a and b on `dates` and previews it. `excludeSwapId` is the swap
 * itself when re-checking an existing one (at accept and approval time).
 */
export async function checkSwap(aId: string, bId: string, rawDates: string[], excludeSwapId?: string): Promise<SwapCheck> {
  const fail = (error: string): SwapCheck => ({ ok: false, error });
  const dates = [...new Set(rawDates)].sort();
  if (dates.length === 0 || dates.length > 2) return fail("Pick one date, or two for a give-and-take swap.");
  if (aId === bId) return fail("Pick someone else to swap with.");

  const staff = await db.staff.findMany({ where: { id: { in: [aId, bId] } } });
  const a = staff.find((s) => s.id === aId);
  const b = staff.find((s) => s.id === bId);
  if (!a || !b) return fail("Staff not found.");
  for (const p of [a, b]) {
    if (!p.active || p.role === "MANAGEMENT" || !p.shiftId) return fail(`${p.name} is not on a shift roster, so cannot swap duties.`);
  }

  const clash = await findSwapClash([aId, bId], dates, excludeSwapId);
  if (clash) {
    const who = [clash.swap.requesterId, clash.swap.partnerId].includes(aId) ? a.name : b.name;
    return fail(`${who} is already in a duty swap on ${formatDate(clash.date)}. One swap per person per day.`);
  }

  // No swap on a day either person has leave (pending or approved, including BD / BD-IL).
  for (const p of [a, b]) {
    const leave = await findLeaveConflict(p.id, dates);
    if (leave) return fail(`${p.name} has ${leave.status === "PENDING" ? "pending " : ""}${leave.code} on ${formatDate(leave.date)}. Duties cannot be swapped on a leave day.`);
  }

  const from = dates[0];
  const to = addDays(dates[dates.length - 1], 7);
  const ctx = await loadDutyContext([aId, bId], from, to, { excludeSwapId });
  const { rows, ripples } = previewSwap(ctx.people, ctx.swaps, { swapId: excludeSwapId ?? "new", a: aId, b: bId, dates }, dateRange(from, to));
  for (const r of rows) {
    if (!dutiesDiffer(r.aBefore, r.bBefore)) {
      return fail(`${a.name} and ${b.name} both have ${dutyWord(r.aBefore)} on ${formatDate(r.date)}, so there is nothing to swap that day.`);
    }
  }
  return { ok: true, rows, ripples, names: { [aId]: `${a.name} (${a.shiftId})`, [bId]: `${b.name} (${b.shiftId})` } };
}

function dutyWord(d: Duty): string {
  return d === "OFF" || d === "OFF_V" ? "a day off" : d === "VSB" ? "V(SB)" : d;
}

// ---------- Listing ----------

export type SwapSummary = {
  id: string;
  requester: SwapPerson;
  partner: SwapPerson;
  requesterShiftId: string;
  partnerShiftId: string;
  status: SwapStatus;
  dates: string[];
  notes: string | null;
  rejectReason: string | null;
  submittedAt: string;
  createdByName: string;
  /** Recorded by a supervisor or Management rather than requested by the requester. */
  recorded: boolean;
  requesterSideBy: string | null;
  partnerSideBy: string | null;
  /** Each date before the swap: what each person would have worked. */
  rows: { date: string; requesterDuty: Duty; partnerDuty: Duty }[];
  /** What the viewer can do now. */
  can: { respond: boolean; withdraw: boolean; approve: boolean; reject: boolean; cancel: boolean };
  /** For a pending swap: why it cannot go through as things stand (checked when shown). */
  problem: string | null;
};

const swapInclude = { requester: true, partner: true, days: { orderBy: { date: "asc" as const } } };

export function canApproveSide(viewer: Viewer, shiftId: string): boolean {
  return canEditShift(viewer, shiftId);
}

/** Swaps the viewer is in, or that touch a shift they supervise. Recent and active ones only. */
export async function getSwapsFor(viewer: Viewer, opts: { since?: string } = {}): Promise<SwapSummary[]> {
  const editableShifts = ["A", "B", "C"].filter((id) => canEditShift(viewer, id));
  const since = opts.since ?? addDays(new Date().toISOString().slice(0, 10), -60);
  const swaps = await db.dutySwap.findMany({
    where: {
      AND: [
        {
          OR: [
            { requesterId: viewer.id },
            { partnerId: viewer.id },
            { requesterShiftId: { in: editableShifts } },
            { partnerShiftId: { in: editableShifts } },
          ],
        },
        { OR: [{ status: { in: ACTIVE_SWAP_STATUSES } }, { submittedAt: { gte: new Date(since) } }] },
      ],
    },
    include: swapInclude,
    orderBy: { submittedAt: "asc" },
  });
  return Promise.all(swaps.map((s) => summarize(viewer, s)));
}

export async function loadSwap(id: string) {
  return db.dutySwap.findUnique({ where: { id }, include: swapInclude });
}

async function summarize(viewer: Viewer, s: NonNullable<Awaited<ReturnType<typeof loadSwap>>>): Promise<SwapSummary> {
  const status = s.status as SwapStatus;
  const dates = s.days.map((d) => d.date);
  const namesNeeded = [s.createdById, s.requesterSideById, s.partnerSideById].filter((x): x is string => Boolean(x));
  const names = new Map((await db.staff.findMany({ where: { id: { in: namesNeeded } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]));

  // Before-swap duties on each date (this swap left out, so an approved one shows what it replaced).
  const ctx = await loadDutyContext([s.requesterId, s.partnerId], dates[0], dates[dates.length - 1], { excludeSwapId: s.id });
  const rows = dates.map((date) => ({ date, requesterDuty: ctx.resolve(s.requesterId, date).duty, partnerDuty: ctx.resolve(s.partnerId, date).duty }));

  const editsA = canApproveSide(viewer, s.requesterShiftId);
  const editsB = canApproveSide(viewer, s.partnerShiftId);
  const pendingSides = (!s.requesterSideById && editsA) || (!s.partnerSideById && editsB);
  const pending = (PENDING_SWAP_STATUSES as string[]).includes(status);
  const can = {
    respond: status === "PENDING_PARTNER" && viewer.id === s.partnerId,
    withdraw: pending && viewer.id === s.requesterId && s.createdById === s.requesterId,
    approve: status === "PENDING_APPROVAL" && pendingSides,
    reject: pending && (editsA || editsB),
    cancel: status === "APPROVED" && (editsA || editsB),
  };
  let problem: string | null = null;
  if (pending) {
    const check = await checkSwap(s.requesterId, s.partnerId, dates, s.id);
    if (!check.ok) problem = check.error;
  }
  return {
    id: s.id,
    requester: { id: s.requester.id, name: s.requester.name, shiftId: s.requester.shiftId },
    partner: { id: s.partner.id, name: s.partner.name, shiftId: s.partner.shiftId },
    requesterShiftId: s.requesterShiftId,
    partnerShiftId: s.partnerShiftId,
    status,
    dates,
    notes: s.notes,
    rejectReason: s.rejectReason,
    submittedAt: s.submittedAt.toISOString(),
    createdByName: names.get(s.createdById) ?? "",
    recorded: s.createdById !== s.requesterId,
    requesterSideBy: s.requesterSideById ? (names.get(s.requesterSideById) ?? "") : null,
    partnerSideBy: s.partnerSideById ? (names.get(s.partnerSideById) ?? "") : null,
    rows,
    can,
    problem,
  };
}

/** How many swaps are waiting on the viewer: to answer as partner, or to approve as supervisor. */
export async function swapsAwaiting(viewer: Viewer): Promise<number> {
  const swaps = await db.dutySwap.findMany({
    where: { status: { in: PENDING_SWAP_STATUSES } },
    select: { status: true, partnerId: true, requesterShiftId: true, partnerShiftId: true, requesterSideById: true, partnerSideById: true },
  });
  return swaps.filter((s) =>
    s.status === "PENDING_PARTNER"
      ? s.partnerId === viewer.id
      : (!s.requesterSideById && canApproveSide(viewer, s.requesterShiftId)) || (!s.partnerSideById && canApproveSide(viewer, s.partnerShiftId)),
  ).length;
}
