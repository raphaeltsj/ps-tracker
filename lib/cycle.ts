// Duty cycle and V duty overlay (spec sections 3 and 5). Pure functions: no storage of the calendar.
import { addDays, dayIndex } from "@/lib/dates";
import type { AssignableDuty, Duty, ShiftDuty } from "@/lib/domain";

/** 2 PM, 2 AM, 2 Off, repeating. */
export const CYCLE: ShiftDuty[] = ["PM", "PM", "AM", "AM", "OFF", "OFF"];

/** Position 0-5 in the cycle. `anchor` is the day index on which the shift works PM Day 1. */
export function cyclePosition(anchor: number, date: string): number {
  return (((dayIndex(date) - anchor) % 6) + 6) % 6;
}

export function shiftDutyOn(anchor: number, date: string): ShiftDuty {
  return CYCLE[cyclePosition(anchor, date)];
}

const BLOCK_NAME: Record<ShiftDuty, string> = { PM: "PM", AM: "AM", OFF: "Off" };

/** e.g. "PM Day 1 of 2, next: AM" */
export function cyclePositionLabel(anchor: number, date: string): string {
  const pos = cyclePosition(anchor, date);
  const block = CYCLE[pos];
  const next = CYCLE[(pos - (pos % 2) + 2) % 6];
  return `${BLOCK_NAME[block]} Day ${(pos % 2) + 1} of 2, next: ${BLOCK_NAME[next]}`;
}

export type EffectiveDuty = {
  duty: Duty;
  /** cycle = normal rotation, override = set by a supervisor, postV = PM block turned Off after V */
  source: "cycle" | "override" | "postV";
};

/**
 * A person's duty on a date: a supervisor override wins; otherwise the shift cycle, except that a PM
 * block directly after a 2-day V (worked on the preceding Off days) becomes "Off(V)".
 * An Off set by a supervisor is also an Off(V): it is the rest day awarded for V duty, for example
 * to a V(SB) who was activated. Cancelling the V duty restores the PM block by itself, because
 * nothing about it is stored.
 */
export function effectiveDuty(
  anchor: number,
  date: string,
  overrides: ReadonlyMap<string, AssignableDuty>,
): EffectiveDuty {
  const override = overrides.get(date);
  if (override) return { duty: override === "OFF" ? "OFF_V" : override, source: "override" };

  const pos = cyclePosition(anchor, date);
  const base = CYCLE[pos];
  if (base === "PM") {
    const blockStart = addDays(date, -pos);
    if (overrides.get(addDays(blockStart, -1)) === "V" || overrides.get(addDays(blockStart, -2)) === "V") {
      return { duty: "OFF_V", source: "postV" };
    }
  }
  return { duty: base, source: "cycle" };
}
