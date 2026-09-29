"use client";
import { Check, X } from "lucide-react";
import { useMemo, useState } from "react";
import { createStaff, setStaffActive, setStaffProficiency, updateStaff } from "@/app/staff-actions";
import { ResultMessage, useAction } from "@/components/roster/use-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/dates";
import { ROLE_LABEL } from "@/lib/domain";
import type { ProficiencyLevel, ProficiencyMap } from "@/lib/proficiency";
import { STAFF_NAME_MAX, type StaffRole } from "@/lib/staff";
import { cn } from "@/lib/utils";

export type StaffRow = { id: string; name: string; role: StaffRole; shiftId: string; birthday: string | null; active: boolean };
export type TaskOption = { id: string; name: string };

const SHIFTS = ["A", "B", "C"];

function RoleSelect({ value, onChange, id }: { value: StaffRole; onChange: (v: StaffRole) => void; id?: string }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value as StaffRole)} className="h-8 rounded-md border bg-background px-1.5 text-xs">
      <option value="STAFF">Regular Staff</option>
      <option value="SUPERVISOR">Supervisor</option>
    </select>
  );
}

/** Add, edit and deactivate staff: supervisors for their own shift, Management for any shift (role
 * and shift move are Management only). Never deleted: deactivating keeps their history. Also manages
 * each person's Task proficiency (spec: staff proficiency), never shown to staff themselves. */
export function StaffManager({
  shiftId,
  staff,
  allStaff,
  viewerId,
  canChangeRoleOrShift,
  tasks,
  proficiency,
}: {
  shiftId: string;
  staff: StaffRow[];
  /** Every shift's staff for Management (so the proficiency matrix can filter by shift without a
   * page reload); the same as `staff` for a supervisor, who only ever sees their own shift. */
  allStaff: StaffRow[];
  viewerId: string;
  canChangeRoleOrShift: boolean;
  tasks: TaskOption[];
  proficiency: ProficiencyMap;
}) {
  const { pending, result, run } = useAction();
  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [role, setRole] = useState<StaffRole>("STAFF");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBirthday, setEditBirthday] = useState("");
  const [editRole, setEditRole] = useState<StaffRole>("STAFF");
  const [editShiftId, setEditShiftId] = useState(shiftId);
  const cols = canChangeRoleOrShift ? 5 : 4;

  const startEdit = (s: StaffRow) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditBirthday(s.birthday ?? "");
    setEditRole(s.role);
    setEditShiftId(s.shiftId);
  };

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-3 rounded-xl border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => createStaff({ name, shiftId, role, birthday: birthday || null }),
            () => {
              setName("");
              setBirthday("");
              setRole("STAFF");
            },
          );
        }}
      >
        <label className="space-y-1" htmlFor="staff-name">
          <span className="block text-xs font-medium text-muted-foreground">Name</span>
          <Input id="staff-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={STAFF_NAME_MAX} className="w-48" placeholder="Full name" />
        </label>
        <label className="space-y-1" htmlFor="staff-birthday">
          <span className="block text-xs font-medium text-muted-foreground">Birthday (optional)</span>
          <Input id="staff-birthday" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className="w-40" />
        </label>
        {canChangeRoleOrShift && (
          <label className="space-y-1" htmlFor="staff-role">
            <span className="block text-xs font-medium text-muted-foreground">Role</span>
            <RoleSelect id="staff-role" value={role} onChange={setRole} />
          </label>
        )}
        <Button type="submit" disabled={pending || name.trim().length === 0}>
          Add to Shift {shiftId}
        </Button>
        <p className="w-full text-xs text-muted-foreground">
          {canChangeRoleOrShift ? "New staff join the shift shown above; move them later by editing their row." : "New staff join Shift " + shiftId + ". Only Management can add a supervisor or move someone between shifts."}
        </p>
      </form>
      <ResultMessage result={result} />

      {/* relative: keeps the absolutely positioned sr-only header text inside the scroll box, so a wide table never widens the page on phones. */}
      <div className="relative overflow-x-auto rounded-xl border" role="region" aria-label="Staff" tabIndex={0}>
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="bg-muted/50 text-left">
              <th className="border-b px-3 py-2 font-semibold">Name</th>
              <th className="border-b px-3 py-2 font-semibold">Role</th>
              {canChangeRoleOrShift && <th className="border-b px-3 py-2 font-semibold">Shift</th>}
              <th className="border-b px-3 py-2 font-semibold">Birthday</th>
              <th className="border-b px-3 py-2 text-right font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => {
              const editing = editingId === s.id;
              const self = s.id === viewerId;
              return (
                <tr key={s.id} className={cn("align-top", !s.active && "text-muted-foreground")}>
                  <td className="border-b px-3 py-2">
                    {editing ? (
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={STAFF_NAME_MAX} aria-label={`Name for ${s.name}`} className="w-48" />
                    ) : (
                      <span className="flex items-center gap-2 font-medium">
                        {s.name}
                        {self && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                        {!s.active && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">Inactive</span>}
                      </span>
                    )}
                  </td>
                  <td className="border-b px-3 py-2">{editing && canChangeRoleOrShift ? <RoleSelect value={editRole} onChange={setEditRole} /> : ROLE_LABEL[s.role]}</td>
                  {canChangeRoleOrShift && (
                    <td className="border-b px-3 py-2">
                      {editing ? (
                        <select value={editShiftId} onChange={(e) => setEditShiftId(e.target.value)} className="h-8 rounded-md border bg-background px-1.5 text-xs">
                          {SHIFTS.map((id) => (
                            <option key={id} value={id}>
                              Shift {id}
                            </option>
                          ))}
                        </select>
                      ) : (
                        `Shift ${s.shiftId}`
                      )}
                    </td>
                  )}
                  <td className="border-b px-3 py-2">
                    {editing ? (
                      <Input type="date" value={editBirthday} onChange={(e) => setEditBirthday(e.target.value)} className="w-40" aria-label={`Birthday for ${s.name}`} />
                    ) : s.birthday ? (
                      formatDate(s.birthday)
                    ) : (
                      "–"
                    )}
                  </td>
                  <td className="border-b px-3 py-2 text-right">
                    <span className="flex justify-end gap-1">
                      {editing ? (
                        <>
                          <Button
                            size="sm"
                            disabled={pending || editName.trim().length === 0}
                            onClick={() =>
                              run(
                                () =>
                                  updateStaff({
                                    id: s.id,
                                    name: editName,
                                    birthday: editBirthday || null,
                                    role: canChangeRoleOrShift ? editRole : undefined,
                                    shiftId: canChangeRoleOrShift ? editShiftId : undefined,
                                  }),
                                () => setEditingId(null),
                              )
                            }
                          >
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => startEdit(s)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending || (s.active && self)}
                            title={s.active && self ? "You cannot deactivate your own account" : undefined}
                            onClick={() => run(() => setStaffActive(s.id, !s.active))}
                          >
                            {s.active ? "Deactivate" : "Reactivate"}
                          </Button>
                        </>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
            {staff.length === 0 && (
              <tr>
                <td colSpan={cols} className="px-3 py-6 text-center text-muted-foreground">
                  No staff yet. Add the first one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ProficiencyMatrix staff={allStaff} tasks={tasks} proficiency={proficiency} defaultShiftId={shiftId} showShiftFilter={canChangeRoleOrShift} />
    </div>
  );
}

const NEXT_LEVEL: Record<ProficiencyLevel, ProficiencyLevel> = { NONE: "PROFICIENT", PROFICIENT: "UNDERSTUDY", UNDERSTUDY: "NONE" };
const SHIFT_IDS = ["A", "B", "C"];

/** One cell of the matrix: a single button that cycles Not trained -> Proficient -> Understudy ->
 * Not trained, so setting proficiency for many people across many Tasks stays a quick click each. */
function ProficiencyCell({ staffId, taskId, level }: { staffId: string; taskId: string; level: ProficiencyLevel }) {
  const { pending, run } = useAction();
  const label = level === "PROFICIENT" ? "Proficient — click to mark as understudy" : level === "UNDERSTUDY" ? "Understudy (U/S) — click to clear" : "Not trained — click to mark proficient";
  return (
    <button
      type="button"
      disabled={pending}
      title={label}
      aria-label={label}
      onClick={() => run(() => setStaffProficiency({ staffId, taskId, level: NEXT_LEVEL[level] }))}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md border text-[11px] font-bold transition-colors disabled:opacity-60",
        level === "PROFICIENT" && "border-success bg-success text-white hover:bg-success/90 dark:text-background",
        // Softer than proficient: training is still in progress.
        level === "UNDERSTUDY" && "border-warning bg-warning-soft text-warning-ink hover:bg-warning/25",
        level === "NONE" && "border-muted-foreground/30 bg-muted/40 text-muted-foreground hover:bg-muted",
      )}
    >
      {level === "PROFICIENT" ? <Check className="size-3.5" /> : level === "UNDERSTUDY" ? "U/S" : <X className="size-3.5" />}
    </button>
  );
}

/** Which Tasks each person can do, and who is currently an understudy for one. Never shown to staff,
 * never affects the roster: purely a record supervisors/Management keep (spec: staff proficiency).
 * A grid rather than a per-row expander, so it stays usable as Management adds more Tasks over time —
 * the table scrolls horizontally with a sticky name column, the same pattern as the roster grid. */
function ProficiencyMatrix({
  staff,
  tasks,
  proficiency,
  defaultShiftId,
  showShiftFilter,
}: {
  staff: StaffRow[];
  tasks: TaskOption[];
  proficiency: ProficiencyMap;
  defaultShiftId: string;
  showShiftFilter: boolean;
}) {
  const [shiftFilter, setShiftFilter] = useState<string>(defaultShiftId);
  const rows = useMemo(
    () =>
      staff
        .filter((s) => shiftFilter === "ALL" || s.shiftId === shiftFilter)
        .sort((a, b) => (a.shiftId === b.shiftId ? a.name.localeCompare(b.name) : a.shiftId.localeCompare(b.shiftId))),
    [staff, shiftFilter],
  );

  return (
    <div className="space-y-2 rounded-xl border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Task proficiency</h2>
          <p className="text-xs text-muted-foreground">Only supervisors and Management see this. It never affects the roster — a record of who is trained for which Task.</p>
        </div>
        {showShiftFilter && (
          <div className="flex rounded-lg border p-0.5 text-xs" role="tablist" aria-label="Filter proficiency by shift">
            {["ALL", ...SHIFT_IDS].map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={shiftFilter === id}
                onClick={() => setShiftFilter(id)}
                className={cn("rounded-md px-2.5 py-1", shiftFilter === id ? "bg-secondary font-semibold" : "text-muted-foreground")}
              >
                {id === "ALL" ? "All shifts" : `Shift ${id}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground">No Tasks yet. Management adds Tasks on the Tasks page.</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No staff to show.</p>
      ) : (
        <div className="relative max-h-[28rem] overflow-auto rounded-lg border" role="region" aria-label="Task proficiency matrix" tabIndex={0}>
          <table className="w-full min-w-max border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-20 min-w-28 border-b border-r bg-background px-2 py-1.5 text-left font-semibold sm:min-w-40">Name</th>
                {tasks.map((t) => (
                  <th key={t.id} title={t.name} className="sticky top-0 z-10 min-w-14 border-b border-r bg-background px-1 py-1.5 text-center font-semibold">
                    {t.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className={cn(!s.active && "opacity-60")}>
                  <th className="sticky left-0 z-10 border-b border-r bg-background px-2 py-1 text-left font-medium">
                    <span className="flex items-center gap-1.5">
                      {s.name}
                      {shiftFilter === "ALL" && <span className="text-[10px] text-muted-foreground">Shift {s.shiftId}</span>}
                      {!s.active && <span className="text-[10px] text-muted-foreground">(inactive)</span>}
                    </span>
                  </th>
                  {tasks.map((t) => (
                    <td key={t.id} className="border-b border-r px-1 py-1 text-center">
                      <ProficiencyCell staffId={s.id} taskId={t.id} level={proficiency[s.id]?.[t.id] ?? "NONE"} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-5 w-7 items-center justify-center rounded border border-success bg-success text-white dark:text-background">
            <Check className="size-3" />
          </span>
          Proficient
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-5 w-7 items-center justify-center rounded border border-warning bg-warning-soft text-[11px] font-bold text-warning-ink">U/S</span>
          Understudy (training)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-5 w-7 items-center justify-center rounded border border-muted-foreground/30 bg-muted/40 text-muted-foreground">
            <X className="size-3" />
          </span>
          Not trained
        </span>
      </div>
    </div>
  );
}
