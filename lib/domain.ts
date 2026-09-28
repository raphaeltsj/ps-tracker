// Shared domain constants and types (spec: docs/system-context.md).

export const ROLES = ["STAFF", "SUPERVISOR", "MANAGEMENT"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  STAFF: "Regular Staff",
  SUPERVISOR: "Supervisor",
  MANAGEMENT: "Management",
};

/**
 * Duties a supervisor can assign from the one duty picker. AM and PM are not here: they come from
 * the shift cycle and are never set by hand (spec 5.1). An assigned OFF is an Off awarded because
 * of V duty, shown as "Off(V)".
 */
export const ASSIGNABLE_DUTIES = ["V", "VSB", "OFF"] as const;
export type AssignableDuty = (typeof ASSIGNABLE_DUTIES)[number];

/**
 * Effective duty on a day. AM, PM and OFF come from the cycle; OFF_V is an Off awarded for V duty,
 * either given by a supervisor or derived from the PM block after a 2-day V.
 */
export type Duty = "AM" | "PM" | "V" | "VSB" | "OFF" | "OFF_V";

/** What a whole shift works on a day in the normal cycle. OFF = Rest day. */
export type ShiftDuty = "AM" | "PM" | "OFF";

export const DUTY_LABEL: Record<Duty, string> = {
  AM: "AM",
  PM: "PM",
  V: "V",
  VSB: "V(SB)",
  OFF: "Off",
  OFF_V: "Off(V)",
};

/** DOS / DOS2IC / FDO: the same 24-hour duty under three names (spec 5.2). */
export const DOS_KINDS = ["DOS", "DOS2IC", "FDO"] as const;
export type DosKind = (typeof DOS_KINDS)[number];

export const DOS_REPORT_TIME = "0800";
export const DOS_LABEL = "DOS/FDO";
/** The half-day OIL a DOS/FDO duty always earns the next day. */
export const DOS_OIL_CODE = "0.5 OIL";
export const DOS_OIL_HALF = "FIRST";

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
  // MC without a medical certificate.
  { code: "OML", name: "Ordinary Medical leave" },
  { code: "MC", name: "Medical leave" },
  { code: "HL", name: "Hospitalised leave" },
  { code: "FCL", name: "Family care leave" },
  { code: "CSE", name: "Course leave" },
  { code: "BD", name: "Birthday leave" },
  { code: "BD-IL", name: "Birthday off in lieu" },
  { code: "0.5 OIL", name: "Half-day off in lieu", halfDay: true },
  { code: "1 OIL", name: "Off in lieu (full day)" },
  { code: "GRW", name: "Growth Day" },
  { code: "0.5 GRW", name: "Half-day growth day", halfDay: true },
];

/**
 * The type a half/full-day pair of codes share, for combining them in stats: "0.5 AL" and "AL" are
 * both "AL"; "0.5 OIL" and "1 OIL" are both "OIL". Everything else is its own base code unchanged.
 */
export function baseLeaveCode(code: string): string {
  return code.replace(/^(?:0\.5|1)\s+/, "");
}

export const NAME_MAX = 6; // Task names and custom leave type codes

export const MFL: Record<"weekday" | "weekend", { AM: number; PM: number; V: number }> = {
  weekday: { AM: 13, PM: 12, V: 1 },
  weekend: { AM: 14, PM: 11, V: 1 },
};
