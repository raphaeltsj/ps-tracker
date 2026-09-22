import "server-only";
import { buildRoster } from "@/lib/roster-data";
import type { LeaveSummary } from "@/lib/roster-types";

/** Dates where the shift has less than `amount` of an Available Slot (spec 12.3). */
export async function datesWithoutSlot(shiftId: string, dates: string[], amount: number): Promise<{ date: string; slots: number }[]> {
  if (dates.length === 0) return [];
  const sorted = [...dates].sort();
  const roster = await buildRoster(shiftId, sorted[0], sorted[sorted.length - 1], null);
  return sorted.map((date) => ({ date, slots: roster.days[date].strength.slots })).filter((d) => d.slots < amount);
}

/** For a pending request: the first date with no slot, which disables Approve. */
export async function firstDateWithoutSlot(leave: LeaveSummary): Promise<string | null> {
  if (leave.status !== "PENDING" || !leave.shiftId) return null;
  const missing = await datesWithoutSlot(leave.shiftId, leave.days, leave.halfDay ? 0.5 : 1);
  return missing[0]?.date ?? null;
}
