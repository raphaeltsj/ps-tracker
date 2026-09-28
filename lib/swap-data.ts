import "server-only";
import { addDays, dateRange, formatDate, todayLocal } from "@/lib/dates";
import { db } from "@/lib/db";
import type { AssignableDuty, Duty } from "@/lib/domain";
import { findLeaveConflict } from "@/lib/leave-rules";
import { buildRoster } from "@/lib/roster-data";
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
  isVDuty,
  linkedDates,
  vThenAm,
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
    include: { swap: { select: { requesterId: true, partnerId: true, requesterShiftId: true, partnerShiftId: true } } },
  });
  // Each swap uses the shifts the two people were in when it was made (see SwapDate).
  const anchorOf = new Map((await db.shift.findMany()).map((sh) => [sh.id, sh.cycleAnchor]));
  const swaps: SwapDate[] = swapDays.map((d) => ({
    swapId: d.swapId,
    date: d.date,
    a: d.swap.requesterId,
    b: d.swap.partnerId,
    anchors: { a: anchorOf.get(d.swap.requesterShiftId)!, b: anchorOf.get(d.swap.partnerShiftId)! },
    shifts: { a: d.swap.requesterShiftId, b: d.swap.partnerShiftId },
    linked: d.linked,
  }));

  const people = new Map<string, PersonCycle>(opts.known);
  const needed = [...new Set([...staffIds, ...swaps.flatMap((s) => [s.a, s.b])])];
  const info = await db.staff.findMany({ where: { id: { in: needed } }, include: { shift: true } });
  const missing = info.filter((s) => !people.has(s.id));
  if (missing.length) {
    const overrides = await db.dutyOverride.findMany({ where: { staffId: { in: missing.map((s) => s.id) }, date: { gte: addDays(loadFrom, -LOOK_BACK), lte: to } } });
    for (const s of missing) {
      // Someone who has since left the shift roster still has their swaps: use the shift from the swap.
      const swapShift = swaps.find((x) => x.a === s.id)?.anchors?.a ?? swaps.find((x) => x.b === s.id)?.anchors?.b;
      const anchor = s.shift?.cycleAnchor ?? swapShift;
      if (anchor === undefined) continue; // Management: no cycle, never in a swap
      const map = new Map<string, AssignableDuty>();
      for (const o of overrides) if (o.staffId === s.id) map.set(o.date, o.duty as AssignableDuty);
      people.set(s.id, { anchor, overrides: map });
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

/**
 * Message for dates a person cannot change because an approved swap holds them, or null. A pending
 * request never blocks anything: it is re-checked when it is accepted and approved.
 */
export async function swapLockMessage(staffId: string, who: string, dates: string[], what: string): Promise<string | null> {
  if (dates.length === 0) return null;
  const clash = await findSwapClash([staffId], dates, undefined, ["APPROVED"]);
  if (!clash) return null;
  const other = clash.swap.requesterId === staffId ? clash.swap.partner : clash.swap.requester;
  const otherShift = clash.swap.requesterId === staffId ? clash.swap.partnerShiftId : clash.swap.requesterShiftId;
  return `${who} ${who === "You" ? "have" : "has"} an approved duty swap with ${other.name} (${otherShift}) on ${formatDate(clash.date)}, so ${what} cannot change that day. A supervisor must cancel the swap first.`;
}

/**
 * Would these duty changes alter a date held by an approved swap? A V placed (or removed) near a
 * swapped date can turn a PM block into Off(V) or back, which silently changes what the two people
 * agreed to exchange. Returns a message naming the swap, or null. `duty` null = reset to cycle.
 */
export async function swapAffectedByDutyChange(changes: { staffId: string; date: string; duty: AssignableDuty | null }[]): Promise<string | null> {
  if (changes.length === 0) return null;
  const staffIds = [...new Set(changes.map((c) => c.staffId))];
  const dates = changes.map((c) => c.date).sort();
  // A V earns Off(V) on a PM block up to 6 days later (8 covers post-V's look-back too).
  // From the day before (a V there leads into the changed day) to the last day a V can still move an Off(V).
  const from = addDays(dates[0], -1);
  const to = addDays(dates[dates.length - 1], LOOK_BACK);
  const held = await db.dutySwapDay.findMany({
    where: { date: { gte: from, lte: to }, swap: { status: "APPROVED", OR: [{ requesterId: { in: staffIds } }, { partnerId: { in: staffIds } }] } },
    include: { swap: { include: { requester: true, partner: true } } },
    orderBy: { date: "asc" },
  });
  if (held.length === 0) return null;

  const ctx = await loadDutyContext(staffIds, from, to);
  const changed = new Map(ctx.people);
  for (const id of staffIds) {
    const person = ctx.people.get(id);
    if (!person) continue;
    const overrides = new Map(person.overrides);
    for (const c of changes.filter((x) => x.staffId === id)) {
      if (c.duty) overrides.set(c.date, c.duty);
      else overrides.delete(c.date);
    }
    changed.set(id, { ...person, overrides });
  }
  const after = makeDutyResolver(changed, ctx.swaps);
  for (const day of held) {
    for (const id of [day.swap.requesterId, day.swap.partnerId]) {
      if (ctx.resolve(id, day.date).duty !== after(id, day.date).duty) {
        const { requester: r, partner: p } = day.swap;
        return `This would change what ${r.name} (${day.swap.requesterShiftId}) and ${p.name} (${day.swap.partnerShiftId}) swapped on ${formatDate(day.date)} (a V changes the PM block after it into Off(V)). Cancel that swap first, then change the duty.`;
      }
    }
  }
  // No V night straight into an AM at 0745 when either day comes from a swap (checked at approval
  // for the swap itself; this catches a V assigned afterwards next to a swapped day).
  for (const c of changes) {
    for (const vDay of [addDays(c.date, -1), c.date]) {
      const next = addDays(vDay, 1);
      const v = after(c.staffId, vDay), am = after(c.staffId, next);
      if (v.duty === "V" && am.duty === "AM" && (v.swap || am.swap)) {
        const name = (await db.staff.findUnique({ where: { id: c.staffId } }))?.name ?? "This person";
        return `${name} would work V on ${formatDate(vDay)} (until 0745) and then AM at 0745 on ${formatDate(next)}, which comes from a duty swap: no rest. Cancel or change the swap first.`;
      }
    }
  }
  return null;
}

export type SwapCheck =
  | {
      ok: true;
      rows: SwapPreviewRow[];
      ripples: SwapRipple[];
      names: Record<string, string>;
      warnings: string[];
      /** Follow-on days of a V swap (the PM block after it), stored with the swap and locked like it. */
      linked: string[];
    }
  | { ok: false; error: string };

type Proposal = { a: string; b: string; dates: string[]; excludeSwapId?: string };

/**
 * Everything evaluateSwap needs, loaded once for any number of proposed or existing swaps (the swap
 * list checks every pending swap on each view, so this keeps it to a handful of queries).
 */
async function loadSwapFacts(proposals: Proposal[]) {
  const ids = [...new Set(proposals.flatMap((p) => [p.a, p.b]))];
  const allDates = [...new Set(proposals.flatMap((p) => p.dates))].sort();
  const from = allDates[0];
  const to = allDates[allDates.length - 1];
  // The swap dates plus the week after them, where a V swap's follow-on (Off(V)) days fall.
  const span = dateRange(from, addDays(to, 7));
  const [staff, active, leaveDays, extras, dos, ctx] = await Promise.all([
    db.staff.findMany({ where: { id: { in: ids } } }),
    db.dutySwapDay.findMany({
      where: { date: { in: span }, swap: { status: { in: ACTIVE_SWAP_STATUSES }, OR: [{ requesterId: { in: ids } }, { partnerId: { in: ids } }] } },
      include: { swap: { select: { requesterId: true, partnerId: true } } },
      orderBy: { date: "asc" },
    }),
    db.leaveDay.findMany({ where: { date: { in: span }, leave: { staffId: { in: ids }, status: { in: ["PENDING", "APPROVED"] } } }, include: { leave: true }, orderBy: { date: "asc" } }),
    db.extraShiftDuty.findMany({ where: { staffId: { in: ids }, date: { in: span } }, orderBy: { date: "asc" } }),
    db.extraDuty.findMany({ where: { staffId: { in: ids }, date: { in: allDates } }, orderBy: { date: "asc" } }),
    loadDutyContext(ids, from, addDays(to, 7)),
  ]);
  const leave = new Map<string, { date: string; code: string; status: string }[]>();
  const addLeave = (staffId: string, entry: { date: string; code: string; status: string }) => leave.set(staffId, [...(leave.get(staffId) ?? []), entry]);
  for (const d of leaveDays) addLeave(d.leave.staffId, { date: d.date, code: d.leave.typeCode, status: d.leave.status });
  // BD / BD-IL are derived from the birthday: only worth building for birthdays near these dates.
  for (const person of staff.filter((p) => p.birthday && p.shiftId && birthdayNear(p.birthday, span))) {
    const roster = await buildRoster(person.shiftId!, from, span[span.length - 1], null, { staffIds: [person.id] });
    for (const date of span) {
      const derived = roster.cells[person.id]?.[date]?.absences.find((x) => x.derived && x.counts > 0);
      if (derived) addLeave(person.id, { date, code: derived.code, status: "APPROVED" });
    }
  }
  return { staff: new Map(staff.map((p) => [p.id, p])), active, leave, extras, dos, ctx, today: todayLocal() };
}

type SwapFacts = Awaited<ReturnType<typeof loadSwapFacts>>;

/** The swap rules (spec 11.4) for one proposal, from facts already loaded. No database access. */
function evaluateSwap(f: SwapFacts, { a: aId, b: bId, dates, excludeSwapId }: Proposal): SwapCheck {
  const fail = (error: string): SwapCheck => ({ ok: false, error });
  // Past days are done: the roster keeps what was worked, so swaps are for today onwards only.
  if (dates[0] < f.today) return fail("Swap dates must be today or later.");
  const a = f.staff.get(aId);
  const b = f.staff.get(bId);
  if (!a || !b) return fail("Staff not found.");
  for (const p of [a, b]) {
    if (!p.active || p.role === "MANAGEMENT" || !p.shiftId) return fail(`${p.name} is not on a shift roster, so cannot swap duties.`);
  }
  // Supervisors swap only with supervisors, and regular staff only with regular staff.
  if (a.role !== b.role) {
    const sup = a.role === "SUPERVISOR" ? a : b;
    const staff = sup === a ? b : a;
    return fail(`${sup.name} is a supervisor and ${staff.name} is regular staff. Supervisors can only swap with supervisors, and staff with staff.`);
  }

  const clash = f.active.find((d) => d.swapId !== excludeSwapId && dates.includes(d.date) && [aId, bId].some((id) => id === d.swap.requesterId || id === d.swap.partnerId));
  if (clash) {
    const who = [clash.swap.requesterId, clash.swap.partnerId].includes(aId) ? a.name : b.name;
    return fail(`${who} is already in a duty swap on ${formatDate(clash.date)}. One swap per person per day.`);
  }

  // No swap on a day either person has leave (pending or approved, including BD / BD-IL).
  for (const p of [a, b]) {
    const onLeave = (f.leave.get(p.id) ?? []).find((l) => dates.includes(l.date));
    if (onLeave) return fail(`${p.name} has ${onLeave.status === "PENDING" ? "pending " : ""}${onLeave.code} on ${formatDate(onLeave.date)}. Duties cannot be swapped on a leave day.`);
  }

  // Someone serving Extra duty on another shift that day is already double-booked.
  const extra = f.extras.find((e) => (e.staffId === aId || e.staffId === bId) && dates.includes(e.date));
  if (extra) {
    const who = extra.staffId === aId ? a : b;
    return fail(`${who.name} is on Extra duty for Shift ${extra.hostShiftId} on ${formatDate(extra.date)}. Remove the Extra duty first, or pick another date.`);
  }

  const from = dates[0];
  const to = addDays(dates[dates.length - 1], 7);
  const existing = f.ctx.swaps.filter((x) => x.swapId !== excludeSwapId);
  const { rows, ripples } = previewSwap(f.ctx.people, existing, { swapId: excludeSwapId ?? "new", a: aId, b: bId, dates }, dateRange(from, to));
  for (const r of rows) {
    if (!dutiesDiffer(r.aBefore, r.bBefore)) {
      return fail(`${a.name} and ${b.name} both have ${dutyWord(r.aBefore)} on ${formatDate(r.date)}, so there is nothing to swap that day.`);
    }
    // Within a shift, only a V or V(SB) day can be swapped (everyone else there shares the shift's
    // duty). V and V(SB) never go to another shift: the standby and the V person's Off(V) belong to it.
    const vDay = [r.aBefore, r.bBefore].some(isVDuty);
    if (a.shiftId === b.shiftId && !vDay) {
      return fail(`Within a shift, only a V or V(SB) day can be swapped. On ${formatDate(r.date)} neither ${a.name} nor ${b.name} is on V or V(SB): swap with someone from another shift instead.`);
    }
    if (a.shiftId !== b.shiftId && vDay) {
      return fail(`V and V(SB) on ${formatDate(r.date)} can only be swapped with someone in the same shift (Shift ${[r.aBefore].some(isVDuty) ? a.shiftId : b.shiftId}).`);
    }
  }

  // A V swap takes the PM block after it with it (the taker gets the Off(V), the giver works PM):
  // those follow-on days are part of the swap, so they must be free the same way as the swap dates.
  const linked = linkedDates(ripples);
  for (const p of [a, b]) {
    const onLeave = (f.leave.get(p.id) ?? []).find((l) => linked.includes(l.date));
    if (onLeave) return fail(`${p.name} has ${onLeave.status === "PENDING" ? "pending " : ""}${onLeave.code} on ${formatDate(onLeave.date)}, a follow-on day of this V swap (the Off(V) moves with the V). Sort out that leave first.`);
  }
  const linkedClash = f.active.find((d) => d.swapId !== excludeSwapId && linked.includes(d.date) && [aId, bId].some((id) => id === d.swap.requesterId || id === d.swap.partnerId));
  if (linkedClash) {
    const who = [linkedClash.swap.requesterId, linkedClash.swap.partnerId].includes(aId) ? a.name : b.name;
    return fail(`${who} is already in another duty swap on ${formatDate(linkedClash.date)}, a follow-on day of this V swap. One swap per person per day.`);
  }
  const linkedExtra = f.extras.find((e) => (e.staffId === aId || e.staffId === bId) && linked.includes(e.date));
  if (linkedExtra) {
    const who = linkedExtra.staffId === aId ? a : b;
    return fail(`${who.name} is on Extra duty for Shift ${linkedExtra.hostShiftId} on ${formatDate(linkedExtra.date)}, a follow-on day of this V swap. Remove the Extra duty first.`);
  }
  // No V night straight into an AM at 0745 the next morning.
  const after = makeDutyResolver(f.ctx.people, [...existing, ...dates.map((date) => ({ swapId: "new", date, a: aId, b: bId }))]);
  const around = dateRange(addDays(dates[0], -1), dates[dates.length - 1]);
  for (const p of [a, b]) {
    const clashDate = vThenAm((d) => after(p.id, d).duty, around);
    if (clashDate) {
      return fail(
        `${p.name} (${p.shiftId}) would work V on ${formatDate(clashDate)} (until 0745) and then AM at 0745 the next morning, with no rest. Swap both days, or pick another date.`,
      );
    }
  }
  // A DOS/FDO stays with its holder (a 24-hour duty from 0800 on top of the shift duty), but after
  // the swap they are no longer on AM that day, and a swapped date earns no 0.5 OIL. Say so plainly.
  const warnings: string[] = [];
  for (const d of f.dos.filter((x) => (x.staffId === aId || x.staffId === bId) && dates.includes(x.date))) {
    const who = d.staffId === aId ? a : b;
    const row = rows.find((r) => r.date === d.date)!;
    const newDuty = d.staffId === aId ? row.aAfter : row.bAfter;
    warnings.push(
      `${who.name} keeps the ${d.kind} on ${formatDate(d.date)} (24 hours from 0800) on top of the swapped duty (${dutyWord(newDuty)}), and gets no 0.5 OIL for it. To avoid this, move the ${d.kind} to someone on AM first.`,
    );
  }
  return { ok: true, rows, ripples, names: { [aId]: `${a.name} (${a.shiftId})`, [bId]: `${b.name} (${b.shiftId})` }, warnings, linked };
}

/**
 * Checks a proposed swap between a and b on `dates` and previews it. `excludeSwapId` is the swap
 * itself when re-checking an existing one (at accept and approval time).
 */
export async function checkSwap(aId: string, bId: string, rawDates: string[], excludeSwapId?: string): Promise<SwapCheck> {
  const dates = [...new Set(rawDates)].sort();
  if (dates.length === 0 || dates.length > 2) return { ok: false, error: "Pick one date, or two for a give-and-take swap." };
  if (aId === bId) return { ok: false, error: "Pick someone else to swap with." };
  const proposal = { a: aId, b: bId, dates, excludeSwapId };
  return evaluateSwap(await loadSwapFacts([proposal]), proposal);
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
  /** Follow-on days of a V swap (the PM block after it): each person's duty before and after. */
  linkedRows: { date: string; requester: { before: Duty; after: Duty }; partner: { before: Duty; after: Duty } }[];
  /** What the viewer can do now. */
  can: { respond: boolean; withdraw: boolean; approve: boolean; reject: boolean; cancel: boolean };
  /** For a pending swap: why it cannot go through as things stand (checked when shown). */
  problem: string | null;
  /** For a pending swap: things the approvers should know (for example a DOS kept without OIL). */
  warnings: string[];
  /** The first date has passed: an approved swap is now part of what was worked. */
  started: boolean;
};

const swapInclude = { requester: true, partner: true, days: { orderBy: { date: "asc" as const } } };

export function canApproveSide(viewer: Viewer, shiftId: string): boolean {
  return canEditShift(viewer, shiftId);
}

/**
 * A pending request whose first date has arrived can no longer be agreed in time: mark it Expired.
 * Runs whenever swaps are listed or counted, so nothing stale waits for an answer.
 */
export async function expireStaleSwaps(): Promise<void> {
  await db.dutySwap.updateMany({
    where: { status: { in: PENDING_SWAP_STATUSES }, days: { some: { date: { lt: todayLocal() } } } },
    data: { status: "EXPIRED" },
  });
}

/**
 * Swaps the viewer is in, or that touch a shift they supervise. Only swaps with a date from today on
 * are listed: once the dates have passed nobody needs them (the roster still shows who worked what).
 */
export async function getSwapsFor(viewer: Viewer): Promise<SwapSummary[]> {
  await expireStaleSwaps();
  const editableShifts = ["A", "B", "C"].filter((id) => canEditShift(viewer, id));
  const swaps = await db.dutySwap.findMany({
    where: {
      OR: [
        { requesterId: viewer.id },
        { partnerId: viewer.id },
        { requesterShiftId: { in: editableShifts } },
        { partnerShiftId: { in: editableShifts } },
      ],
      days: { some: { date: { gte: todayLocal() } } },
    },
    include: swapInclude,
    orderBy: { submittedAt: "asc" },
  });
  if (swaps.length === 0) return [];
  // One batch of data for every listed swap, then each is summarised without further queries.
  const [facts, names] = await Promise.all([
    loadSwapFacts(swaps.map((s) => ({ a: s.requesterId, b: s.partnerId, dates: exchangeDates(s.days), excludeSwapId: s.id }))),
    db.staff.findMany({
      where: { id: { in: [...new Set(swaps.flatMap((s) => [s.createdById, s.requesterSideById, s.partnerSideById]).filter((x): x is string => Boolean(x)))] } },
      select: { id: true, name: true },
    }),
  ]);
  const nameOf = new Map(names.map((p) => [p.id, p.name]));
  return swaps.map((s) => summarize(viewer, s, facts, nameOf));
}

/** The dates two people exchange duties on (a V swap's follow-on days are stored too, flagged linked). */
export function exchangeDates(days: { date: string; linked: boolean }[]): string[] {
  return days.filter((d) => !d.linked).map((d) => d.date);
}

export async function loadSwap(id: string) {
  return db.dutySwap.findUnique({ where: { id }, include: swapInclude });
}

function summarize(viewer: Viewer, s: NonNullable<Awaited<ReturnType<typeof loadSwap>>>, facts: SwapFacts, names: Map<string, string>): SwapSummary {
  const status = s.status as SwapStatus;
  const dates = exchangeDates(s.days);

  // Before-swap duties on each date (this swap left out, so an approved one shows what it replaced).
  const before = makeDutyResolver(facts.ctx.people, facts.ctx.swaps.filter((x) => x.swapId !== s.id));
  const rows = dates.map((date) => ({ date, requesterDuty: before(s.requesterId, date).duty, partnerDuty: before(s.partnerId, date).duty }));
  // Follow-on days of a V swap: each person's duty there before and after the swap.
  const after = makeDutyResolver(facts.ctx.people, [
    ...facts.ctx.swaps.filter((x) => x.swapId !== s.id),
    ...dates.map((date) => ({ swapId: s.id, date, a: s.requesterId, b: s.partnerId })),
  ]);
  const linkedRows = s.days
    .filter((d) => d.linked)
    .map(({ date }) => ({
      date,
      requester: { before: before(s.requesterId, date).duty, after: after(s.requesterId, date).duty },
      partner: { before: before(s.partnerId, date).duty, after: after(s.partnerId, date).duty },
    }));

  const editsA = canApproveSide(viewer, s.requesterShiftId);
  const editsB = canApproveSide(viewer, s.partnerShiftId);
  const pendingSides = (!s.requesterSideById && editsA) || (!s.partnerSideById && editsB);
  const pending = (PENDING_SWAP_STATUSES as string[]).includes(status);
  const can = {
    respond: status === "PENDING_PARTNER" && viewer.id === s.partnerId,
    withdraw: pending && viewer.id === s.requesterId && s.createdById === s.requesterId,
    approve: status === "PENDING_APPROVAL" && pendingSides,
    reject: pending && (editsA || editsB),
    // Once a swap's first date has passed, it is part of what was worked and cannot be undone.
    cancel: status === "APPROVED" && (editsA || editsB) && dates[0] >= facts.today,
  };
  let problem: string | null = null;
  let warnings: string[] = [];
  if (pending) {
    const check = evaluateSwap(facts, { a: s.requesterId, b: s.partnerId, dates, excludeSwapId: s.id });
    if (!check.ok) problem = check.error;
    else warnings = check.warnings;
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
    linkedRows,
    can,
    problem,
    warnings,
    started: dates[0] < facts.today,
  };
}

/** How many swaps are waiting on the viewer: to answer as partner, or to approve as supervisor. */
export async function swapsAwaiting(viewer: Viewer): Promise<number> {
  await expireStaleSwaps();
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

// ---------- Partner picker ----------

export type SwapCandidateInfo = {
  id: string;
  name: string;
  shiftId: string;
  /** Their duty on each chosen date, before any swap. */
  duties: Duty[];
  /** Why they cannot swap with person A on these dates, or null. Leave and other swaps are checked
   *  here; the full check (BD / BD-IL, no rest after V) runs on the preview. */
  blocked: string | null;
};

/** Everyone person A could swap with on `dates`, with their duties, so the picker is not blind. */
export async function swapCandidates(aId: string, dates: string[]): Promise<{ aDuties: Duty[]; people: SwapCandidateInfo[] }> {
  const staff = await db.staff.findMany({
    where: { active: true, role: { not: "MANAGEMENT" }, shiftId: { not: null } },
    orderBy: [{ shiftId: "asc" }, { name: "asc" }],
  });
  const ids = staff.map((s) => s.id);
  const a = staff.find((s) => s.id === aId);
  if (!a) return { aDuties: [], people: [] };
  const sorted = [...dates].sort();
  const [ctx, leaveDays, swapDays, extraDays] = await Promise.all([
    loadDutyContext(ids, sorted[0], sorted[sorted.length - 1]),
    db.leaveDay.findMany({ where: { date: { in: sorted }, leave: { staffId: { in: ids }, status: { in: ["PENDING", "APPROVED"] } } }, include: { leave: true } }),
    db.dutySwapDay.findMany({ where: { date: { in: sorted }, swap: { status: { in: ACTIVE_SWAP_STATUSES } } }, include: { swap: true } }),
    db.extraShiftDuty.findMany({ where: { date: { in: sorted }, staffId: { in: ids } } }),
  ]);
  const onExtra = new Set(extraDays.map((e) => e.staffId));
  const onLeave = new Set(leaveDays.map((d) => d.leave.staffId));
  const inSwap = new Set(swapDays.flatMap((d) => [d.swap.requesterId, d.swap.partnerId]));
  const aDuties = sorted.map((d) => ctx.resolve(aId, d).duty);

  // Supervisors swap only with supervisors, and staff with staff: the other role never appears.
  const people = staff
    .filter((s) => s.id !== aId && s.role === a.role)
    .map((s) => {
      const duties = sorted.map((d) => ctx.resolve(s.id, d).duty);
      let blocked: string | null = null;
      if (onLeave.has(s.id)) blocked = "On leave";
      else if (inSwap.has(s.id)) blocked = "Already in a swap";
      else if (onExtra.has(s.id)) blocked = "On Extra duty";
      else if (duties.some((d, i) => !dutiesDiffer(d, aDuties[i]))) blocked = "Same duty";
      else if (s.shiftId === a.shiftId && !duties.every((d, i) => isVDuty(d) || isVDuty(aDuties[i]))) blocked = "Same shift: V or V(SB) days only";
      else if (s.shiftId !== a.shiftId && [...duties, ...aDuties].some(isVDuty)) blocked = "V / V(SB): same shift only";
      return { id: s.id, name: s.name, shiftId: s.shiftId!, duties, blocked, birthday: s.birthday };
    });

  // The rest of checkSwap for whoever is still available: no V night straight into an AM, and no
  // BD / BD-IL (derived from the birthday) on the dates.
  const around = dateRange(addDays(sorted[0], -1), sorted[sorted.length - 1]);
  for (const p of people.filter((x) => !x.blocked)) {
    const resolve = makeDutyResolver(ctx.people, [...ctx.swaps, ...sorted.map((date) => ({ swapId: "new", date, a: aId, b: p.id }))]);
    if (vThenAm((d) => resolve(p.id, d).duty, around) || vThenAm((d) => resolve(aId, d).duty, around)) p.blocked = "V then AM: no rest";
    else if (p.birthday && birthdayNear(p.birthday, sorted) && (await findLeaveConflict(p.id, sorted))) p.blocked = "Birthday leave";
  }
  return { aDuties, people: people.map((p) => ({ id: p.id, name: p.name, shiftId: p.shiftId, duties: p.duties, blocked: p.blocked })) };
}

/** BD / BD-IL can only fall on the birthday or up to 21 days after it. */
function birthdayNear(birthday: string, dates: string[]): boolean {
  const md = birthday.slice(5);
  return dates.some((d) => {
    const y = Number(d.slice(0, 4));
    return [y - 1, y].some((year) => {
      const bday = `${year}-${md}`;
      return bday <= d && addDays(bday, 21) >= d;
    });
  });
}
