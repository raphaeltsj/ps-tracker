// Shared domain constants and types (spec: docs/system-context.md).

export const ROLES = ["STAFF", "SUPERVISOR", "MANAGEMENT"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  STAFF: "Regular Staff",
  SUPERVISOR: "Supervisor",
  MANAGEMENT: "Management",
};

/** Duties a supervisor can assign from the one duty picker. */
export const ASSIGNABLE_DUTIES = ["AM", "PM", "V", "VSB", "OFF"] as const;
export type AssignableDuty = (typeof ASSIGNABLE_DUTIES)[number];

/** Effective duty on a day. OFF_POSTV is derived: the PM block replaced by Off after V duty. */
export type Duty = AssignableDuty | "OFF_POSTV";

/** What a whole shift works on a day in the normal cycle. OFF = Rest day. */
export type ShiftDuty = "AM" | "PM" | "OFF";

export const DUTY_LABEL: Record<Duty, string> = {
  AM: "AM",
  PM: "PM",
  V: "V",
  VSB: "V(SB)",
  OFF: "Off",
  OFF_POSTV: "Off (post-V)",
};

export const DUTY_TIMES: Partial<Record<Duty, string>> = {
  AM: "0745-1445",
  PM: "1445-2130",
  V: "2130-0745",
};

/** Actual hours for half-day leave. */
export const HALF_DAY_TIMES: Partial<Record<Duty, { FIRST: string; SECOND: string }>> = {
  AM: { FIRST: "0745-1115", SECOND: "1115-1445" },
  PM: { FIRST: "1445-1800", SECOND: "1800-2130" },
  // TODO(open item): half-day split for V duty is not specified.
  V: { FIRST: "2130-0240", SECOND: "0240-0745" },
};

export function isWorkingDuty(duty: Duty): boolean {
  return duty === "AM" || duty === "PM" || duty === "V";
}

export const LEAVE_STATUSES = ["PENDING", "APPROVED", "REJECTED", "WITHDRAWN", "CANCELLED"] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export const STATUS_LABEL: Record<LeaveStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  CANCELLED: "Cancelled",
};

export type Half = "FIRST" | "SECOND";

/** Common leave types, seeded into the LeaveType table. */
export const COMMON_LEAVE_TYPES: { code: string; name: string; halfDay?: boolean }[] = [
  { code: "AL", name: "Local leave" },
  { code: "0.5 AL", name: "Half-day local leave", halfDay: true },
  { code: "OL", name: "Overseas leave" },
  { code: "MWO", name: "Mental wellness off" },
  // TODO(open item): full name of OML.
  { code: "OML", name: "OML (full name to be added)" },
  { code: "MC", name: "Medical leave" },
  { code: "HL", name: "Hospitalised leave" },
  { code: "FCL", name: "Family care leave" },
  { code: "CSE", name: "Course leave" },
  { code: "BD", name: "Birthday leave" },
  { code: "BD-IL", name: "Birthday off in lieu" },
  { code: "0.5 OIL", name: "Half-day off in lieu", halfDay: true },
  { code: "1 OIL", name: "Off in lieu (full day)" },
];

export const NAME_MAX = 6; // Task names and custom leave type codes

export const MFL: Record<"weekday" | "weekend", { AM: number; PM: number; V: number }> = {
  weekday: { AM: 13, PM: 12, V: 1 },
  weekend: { AM: 14, PM: 11, V: 1 },
};
