// Role and shift access checks (spec section 10). Used by the UI to hide controls AND by every
// Server Action to enforce them.
import type { Role } from "@/lib/domain";

export type Viewer = { id: string; name: string; role: Role; shiftId: string | null };

/** Supervisors edit their own shift; Management edits every shift. */
export function canEditShift(viewer: Viewer, shiftId: string | null): boolean {
  if (viewer.role === "MANAGEMENT") return true;
  return viewer.role === "SUPERVISOR" && shiftId !== null && viewer.shiftId === shiftId;
}

export function hasEditView(viewer: Viewer): boolean {
  return viewer.role === "SUPERVISOR" || viewer.role === "MANAGEMENT";
}

/** Management never requests or takes leave. */
export function canRequestLeave(viewer: Viewer): boolean {
  return viewer.role !== "MANAGEMENT" && viewer.shiftId !== null;
}

export function canRequestOnLockedDate(viewer: Viewer): boolean {
  return viewer.role === "SUPERVISOR";
}

/** Approve/reject a request: an editor of the staff member's shift, or a supervisor approving their own. */
export function canDecideLeave(viewer: Viewer, leaveStaffId: string, leaveShiftId: string | null): boolean {
  if (viewer.role === "SUPERVISOR" && viewer.id === leaveStaffId) return true;
  return canEditShift(viewer, leaveShiftId);
}

export function canManageTasks(viewer: Viewer): boolean {
  return viewer.role === "MANAGEMENT";
}

/** Supervisors manage staff records for their own shift; Management for any shift. */
export function canManageStaff(viewer: Viewer, shiftId: string | null): boolean {
  return canEditShift(viewer, shiftId);
}

export function canAddCustomLeaveType(viewer: Viewer): boolean {
  return viewer.role === "SUPERVISOR" || viewer.role === "MANAGEMENT";
}

/** Task report (count of Tasks done per person). Supervisors default to their own shift. */
export function canViewTaskReport(viewer: Viewer): boolean {
  return viewer.role === "SUPERVISOR" || viewer.role === "MANAGEMENT";
}

/** Dayworkers are added and edited by supervisors and Management (spec 5.3). */
export function canManageDayworkers(viewer: Viewer): boolean {
  return viewer.role === "SUPERVISOR" || viewer.role === "MANAGEMENT";
}
