// Serializable shapes passed from the server loader to client components.
import type { EffectiveDuty } from "@/lib/cycle";
import type { DosKind, Duty, Half, LeaveStatus, Role, ShiftDuty } from "@/lib/domain";
import type { Strength } from "@/lib/strength";

export type CellAbsence = {
  leaveId: string | null; // null for derived BD / BD-IL
  code: string;
  half: Half | null;
  status: LeaveStatus;
  /** Amount counted in Not in Strength: 1, 0.5, or 0 (pending, or a BD marker on an Off day) */
  counts: number;
  derived: boolean;
};

/** True for actual leave (approved or pending). A BD marker on an Off day is not leave. */
export function isLeaveEntry(a: CellAbsence): boolean {
  return !(a.derived && a.counts === 0);
}

export type RosterCell = {
  duty: Duty;
  dutySource: EffectiveDuty["source"];
  /** DOS / DOS2IC / FDO: a 24-hour duty on top of the AM duty (spec 5.2) */
  dos: DosKind | null;
  task: { id: string; name: string } | null;
  absences: CellAbsence[];
};

export type RosterDay = {
  date: string;
  shiftDuty: ShiftDuty;
  strength: Strength;
  /** V cover on the shift's Rest days. MFL for V is always 1. */
  v: { onDuty: number; mfl: number } | null;
  locked: string | null; // remarks
  event: { note: string | null } | null;
};

/** Pseudo row ids: cells in the Ops duty and Extra rows are selected like staff cells, by date. */
export const ROW_OPS = "@ops";
export const ROW_EXTRA = "@extra";
export const isPseudoRow = (id: string) => id === ROW_OPS || id === ROW_EXTRA;

/** A dayworker clocking shift duty on a day (spec 5.3). Not part of the crew: no effect on strength. */
export type OpsEntry = { dayworkerId: string; username: string; name: string; active: boolean };
/** Someone from another shift serving extra duty on this shift's day (spec 5.4). */
export type ExtraEntry = { staffId: string; name: string; fromShiftId: string };

export type StaffRow = { id: string; name: string; role: Role; birthday: string | null };

export type LeaveSummary = {
  id: string;
  staffId: string;
  staffName: string;
  shiftId: string | null;
  typeCode: string;
  typeName: string;
  halfDay: boolean;
  half: Half | null;
  status: LeaveStatus;
  notes: string | null;
  remarks: string | null;
  rejectReason: string | null;
  givenByName: string | null;
  submittedAt: string;
  days: string[];
  /** Created with a DOS/FDO duty: not negotiable, so no edit or cancel. */
  auto: boolean;
  /** Pending only: first requested date with no Available Slot (Approve is disabled). */
  noSlotOn?: string | null;
};

export type RosterData = {
  shiftId: string;
  shiftName: string;
  anchor: number;
  dates: string[];
  staff: StaffRow[];
  cells: Record<string, Record<string, RosterCell>>;
  days: Record<string, RosterDay>;
  leaves: Record<string, LeaveSummary>;
  /** Bottom rows, by date */
  ops: Record<string, OpsEntry[]>;
  extra: Record<string, ExtraEntry[]>;
};

export type LeaveTypeOption = { code: string; name: string; halfDay: boolean; custom: boolean };
export type TaskOption = { id: string; name: string };
export type DayworkerOption = { id: string; name: string; username: string };
/** Staff from other shifts who can be picked for Extra duty */
export type ExtraCandidate = { id: string; name: string; shiftId: string };
