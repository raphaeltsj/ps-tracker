// Duty swaps (spec 11.4). Pure functions: the server loads the data, the roster and the rules use these.
//
// A swap has one or two dates. On each date the two people exchange their duties for that day, one
// for one: each works what the other would have worked. Leave and Tasks do not move, and strength
// does not change (each crew loses one person and gains one on that duty). The Off(V) that a V
// earns follows whoever actually works the V (see VSwaps in lib/cycle.ts).
import { effectiveDuty, type EffectiveDuty } from "@/lib/cycle";
import { addDays } from "@/lib/dates";
import type { AssignableDuty, Duty } from "@/lib/domain";

export const SWAP_STATUSES = ["PENDING_PARTNER", "PENDING_APPROVAL", "APPROVED", "DECLINED", "REJECTED", "WITHDRAWN", "CANCELLED", "EXPIRED"] as const;
export type SwapStatus = (typeof SWAP_STATUSES)[number];

/** Swaps that hold their dates: a person can be in only one of these per date. */
export const ACTIVE_SWAP_STATUSES: SwapStatus[] = ["PENDING_PARTNER", "PENDING_APPROVAL", "APPROVED"];
export const PENDING_SWAP_STATUSES: SwapStatus[] = ["PENDING_PARTNER", "PENDING_APPROVAL"];

export const SWAP_STATUS_LABEL: Record<SwapStatus, string> = {
  PENDING_PARTNER: "Awaiting partner",
  PENDING_APPROVAL: "Awaiting supervisors",
  APPROVED: "Approved",
  DECLINED: "Declined",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  CANCELLED: "Cancelled",
  // A pending request whose first date arrived before it was fully approved.
  EXPIRED: "Expired",
};

/** One swap has one date (a straight exchange) or two (give and take across two dates). */
export const SWAP_MAX_DATES = 2;

/** A person's own roster inputs: their shift's cycle anchor and supervisor overrides by date. */
export type PersonCycle = { anchor: number; overrides: ReadonlyMap<string, AssignableDuty> };

/**
 * One date of an approved swap: `a` and `b` exchange duties on `date`. `anchors` are the cycle
 * anchors of each person's shift when the swap was made: if someone later moves shift (or leaves the
 * shift roster), the swap still exchanges the duties that were agreed.
 */
export type SwapDate = { swapId: string; date: string; a: string; b: string; anchors?: { a: number; b: number }; shifts?: { a: string; b: string } };

export type ResolvedDuty = EffectiveDuty & {
  /** Set when the duty comes from a swap: who with, and what the person would have worked. */
  swap: { swapId: string; partnerId: string; ownDuty: Duty; partnerShiftId?: string } | null;
};

const key = (staffId: string, date: string) => `${staffId}|${date}`;

/**
 * Duty for anyone in `people` on any date, with the approved `swaps` applied. Partners must be in
 * `people` too. Each person is in at most one swap per date (enforced when swaps are made).
 */
export function makeDutyResolver(people: ReadonlyMap<string, PersonCycle>, swaps: readonly SwapDate[]) {
  type Entry = { partnerId: string; swapId: string; ownAnchor?: number; partnerAnchor?: number; partnerShiftId?: string };
  const partnerOn = new Map<string, Entry>();
  for (const s of swaps) {
    partnerOn.set(key(s.a, s.date), { partnerId: s.b, swapId: s.swapId, ownAnchor: s.anchors?.a, partnerAnchor: s.anchors?.b, partnerShiftId: s.shifts?.b });
    partnerOn.set(key(s.b, s.date), { partnerId: s.a, swapId: s.swapId, ownAnchor: s.anchors?.b, partnerAnchor: s.anchors?.a, partnerShiftId: s.shifts?.a });
  }
  const person = (staffId: string) => {
    const p = people.get(staffId);
    if (!p) throw new Error(`No cycle loaded for ${staffId}`);
    return p;
  };

  /** The person's own duty, before the exchange on swapped dates, but with Off(V) following the V. */
  function own(staffId: string, date: string, anchor?: number): EffectiveDuty {
    const p = person(staffId);
    return effectiveDuty(anchor ?? p.anchor, date, p.overrides, {
      swappedAway: (d) => partnerOn.has(key(staffId, d)),
      takenOver: (d) => {
        const partner = partnerOn.get(key(staffId, d));
        return partner !== undefined && people.get(partner.partnerId)?.overrides.get(d) === "V";
      },
    });
  }

  return function resolve(staffId: string, date: string): ResolvedDuty {
    const partner = partnerOn.get(key(staffId, date));
    if (!partner) return { ...own(staffId, date), swap: null };
    return {
      ...own(partner.partnerId, date, partner.partnerAnchor),
      swap: { swapId: partner.swapId, partnerId: partner.partnerId, ownDuty: own(staffId, date, partner.ownAnchor).duty, partnerShiftId: partner.partnerShiftId },
    };
  };
}

export type DutyResolver = ReturnType<typeof makeDutyResolver>;

const isOff = (d: Duty) => d === "OFF" || d === "OFF_V";

/** Exchanging two duties only means something when they differ (Off and Off(V) are both a day off). */
export function dutiesDiffer(a: Duty, b: Duty): boolean {
  return a !== b && !(isOff(a) && isOff(b));
}

export type SwapPreviewRow = { date: string; aBefore: Duty; bBefore: Duty; aAfter: Duty; bAfter: Duty };
/** A day outside the swap dates whose duty changes because of the swap: the Off(V) moving with a V. */
export type SwapRipple = { staffId: string; date: string; before: Duty; after: Duty };

/**
 * What a proposed swap does: each swapped date before and after, plus knock-on changes on other
 * dates (a PM block turning into, or back from, Off(V) when a V changes hands). `existing` are the
 * other approved swaps; `people` must include both people and every partner in `existing`.
 */
export function previewSwap(
  people: ReadonlyMap<string, PersonCycle>,
  existing: readonly SwapDate[],
  proposal: { swapId: string; a: string; b: string; dates: string[] },
  rippleDates: string[],
): { rows: SwapPreviewRow[]; ripples: SwapRipple[] } {
  const before = makeDutyResolver(people, existing);
  const after = makeDutyResolver(people, [...existing, ...proposal.dates.map((date) => ({ swapId: proposal.swapId, date, a: proposal.a, b: proposal.b }))]);
  const rows = proposal.dates.map((date) => ({
    date,
    aBefore: before(proposal.a, date).duty,
    bBefore: before(proposal.b, date).duty,
    aAfter: after(proposal.a, date).duty,
    bAfter: after(proposal.b, date).duty,
  }));
  const ripples: SwapRipple[] = [];
  for (const staffId of [proposal.a, proposal.b]) {
    for (const date of rippleDates) {
      if (proposal.dates.includes(date)) continue;
      const was = before(staffId, date).duty;
      const now = after(staffId, date).duty;
      if (was !== now) ripples.push({ staffId, date, before: was, after: now });
    }
  }
  return { rows, ripples };
}

/**
 * V runs 2130-0745, so an AM the next morning (0745) leaves no rest at all. Returns the first V
 * date in `dates` that is followed by an AM, or null. Checked for both people after a swap.
 */
export function vThenAm(dutyOn: (date: string) => Duty, dates: string[]): string | null {
  for (const date of dates) {
    if (dutyOn(date) === "V" && dutyOn(addDays(date, 1)) === "AM") return date;
  }
  return null;
}
