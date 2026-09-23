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
};

export type LeaveTypeOption = { code: string; name: string; halfDay: boolean; custom: boolean };
export type TaskOption = { id: string; name: string };
