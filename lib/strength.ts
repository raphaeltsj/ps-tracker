// Strength figures and leave slots (spec sections 7 and 8). Always computed, never stored.
import { isWeekend } from "@/lib/dates";
import { MFL, type ShiftDuty } from "@/lib/domain";

export type SlotStatus = "healthy" | "low" | "zero" | "below";

export type Strength = {
  total: number;
  notIn: number;
  working: number;
  /** null on a Rest day (MFL is blank) */
  mfl: number | null;
  slots: number;
  status: SlotStatus;
};

/** MFL for a shift's duty on a date. Rest days have no MFL. */
export function mflFor(duty: ShiftDuty, date: string): number | null {
  if (duty === "OFF") return null;
  return MFL[isWeekend(date) ? "weekend" : "weekday"][duty];
}

export function slotStatus(slots: number): SlotStatus {
  if (slots < 0) return "below";
  if (slots === 0) return "zero";
  if (slots <= 2) return "low";
  return "healthy";
}

/**
 * Total = shift headcount; Not in = sum of approved absences (half-day = 0.5);
 * Working = Total - Not in; Slots = Total - Not in - MFL (MFL blank on Rest days).
 */
export function computeStrength(total: number, notIn: number, mfl: number | null): Strength {
  const working = total - notIn;
  const slots = working - (mfl ?? 0);
  return { total, notIn, working, mfl, slots, status: slotStatus(slots) };
}

/** 21.5 -> "21.5", 21 -> "21" */
export function formatFigure(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function slotLabel(s: Strength): string {
  if (s.status === "zero") return "No slots";
  if (s.status === "below") return `${formatFigure(s.slots)} (below MFL)`;
  return formatFigure(s.slots);
}
