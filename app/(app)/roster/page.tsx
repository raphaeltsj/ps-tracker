import { RosterWorkspace } from "@/components/roster/roster-workspace";
import { requireViewer } from "@/lib/auth";
import { isValidMonth, monthDates, todayLocal } from "@/lib/dates";
import { db } from "@/lib/db";
import { canDecideLeave, canEditShift, canRequestLeave, canRequestOnLockedDate, hasEditView } from "@/lib/permissions";
import { buildRoster, getMyLeaves } from "@/lib/roster-data";
import { firstDateWithoutSlot } from "@/lib/slots";
import { swapsAwaiting } from "@/lib/swap-data";

export const metadata = { title: "Roster | PS Tracker" };

const SHIFT_IDS = ["A", "B", "C"];

export default async function RosterPage({ searchParams }: PageProps<"/roster">) {
  const viewer = await requireViewer();
  const params = await searchParams;
  const param = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);

  const today = todayLocal();
  const shiftId = SHIFT_IDS.includes(param("shift") ?? "") ? param("shift")! : (viewer.shiftId ?? "A");
  const month = isValidMonth(param("month") ?? "") ? param("month")! : today.slice(0, 7);
  const view = param("view") === "calendar" ? "calendar" : "roster";
  const defaultMode = viewer.role === "MANAGEMENT" ? "edit" : "staff";
  const mode = hasEditView(viewer) ? (param("mode") === "edit" || param("mode") === "staff" ? param("mode")! : defaultMode) : "staff";

  const dates = monthDates(month);
  const [roster, leaveTypes, tasks, myLeaves, swapStaff, swapsWaiting] = await Promise.all([
    buildRoster(shiftId, dates[0], dates[dates.length - 1], viewer),
    db.leaveType.findMany({ orderBy: [{ custom: "asc" }, { sortOrder: "asc" }] }),
    db.task.findMany({ orderBy: { createdAt: "asc" } }),
    canRequestLeave(viewer) ? getMyLeaves(viewer.id) : Promise.resolve([]),
    db.staff.findMany({ where: { active: true, role: { not: "MANAGEMENT" }, shiftId: { not: null } }, orderBy: [{ shiftId: "asc" }, { name: "asc" }] }),
    swapsAwaiting(viewer),
  ]);

  // Pick lists for the Ops duty and Extra rows: only editors of this shift need them.
  const editing = mode === "edit" && canEditShift(viewer, shiftId);
  const [dayworkers, extraCandidates] = editing
    ? await Promise.all([
        db.dayworker.findMany({ where: { active: true }, orderBy: { username: "asc" } }),
        db.staff.findMany({ where: { active: true, role: { not: "MANAGEMENT" }, shiftId: { not: shiftId } }, orderBy: [{ shiftId: "asc" }, { name: "asc" }] }),
      ])
    : [[], []];

  // Record mode's "Person 1" list: people the viewer supervises. The partner list itself loads per
  // date from the swap actions, so no full candidate list is needed up front.
  const swapFirstPeople = swapStaff.filter((s) => canEditShift(viewer, s.shiftId)).map((s) => ({ id: s.id, name: s.name, shiftId: s.shiftId! }));

  // Approve is disabled when a requested date has no Available Slot.
  for (const leave of [...Object.values(roster.leaves), ...myLeaves]) {
    if (leave.status === "PENDING" && canDecideLeave(viewer, leave.staffId, leave.shiftId)) {
      leave.noSlotOn = await firstDateWithoutSlot(leave);
    }
  }

  return (
    <RosterWorkspace
      key={`${shiftId}-${month}-${mode}`}
      viewer={viewer}
      roster={roster}
      month={month}
      view={view}
      mode={mode as "staff" | "edit"}
      today={today}
      leaveTypes={leaveTypes.map((t) => ({ code: t.code, name: t.name, halfDay: t.halfDay, custom: t.custom }))}
      tasks={tasks.map((t) => ({ id: t.id, name: t.name }))}
      dayworkers={dayworkers.map((d) => ({ id: d.id, name: d.name, username: d.username }))}
      extraCandidates={extraCandidates.map((c) => ({ id: c.id, name: c.name, shiftId: c.shiftId! }))}
      myLeaves={myLeaves}
      swapFirstPeople={swapFirstPeople}
      swapsWaiting={swapsWaiting}
      canEdit={mode === "edit" && canEditShift(viewer, shiftId)}
      canRequest={canRequestLeave(viewer) && viewer.shiftId === shiftId}
      canRequestLocked={canRequestOnLockedDate(viewer)}
      hasEditView={hasEditView(viewer)}
    />
  );
}
