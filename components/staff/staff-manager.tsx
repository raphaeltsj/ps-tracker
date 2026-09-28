"use client";
import { Fragment, useState } from "react";
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
  viewerId,
  canChangeRoleOrShift,
  tasks,
  proficiency,
}: {
  shiftId: string;
  staff: StaffRow[];
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
  const [proficiencyId, setProficiencyId] = useState<string | null>(null);
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

      <div className="overflow-x-auto rounded-xl border" role="region" aria-label="Staff" tabIndex={0}>
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
                <Fragment key={s.id}>
                <tr className={cn("align-top", !s.active && "text-muted-foreground")}>
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
                          <Button size="sm" variant="outline" onClick={() => setProficiencyId(proficiencyId === s.id ? null : s.id)}>
                            Proficiency
                          </Button>
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
                {proficiencyId === s.id && (
                  <tr>
                    <td colSpan={cols} className="border-b bg-muted/30 px-3 py-3">
                      <ProficiencyEditor staffId={s.id} tasks={tasks} levels={proficiency[s.id] ?? {}} />
                    </td>
                  </tr>
                )}
                </Fragment>
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
    </div>
  );
}

const LEVEL_STYLE: Record<ProficiencyLevel, string> = {
  NONE: "text-muted-foreground hover:bg-accent",
  UNDERSTUDY: "bg-amber-500 text-white",
  PROFICIENT: "bg-emerald-600 text-white",
};

const LEVEL_LABEL: Record<ProficiencyLevel, string> = { NONE: "—", UNDERSTUDY: "(U/S)", PROFICIENT: "Can do" };

/** Which Tasks this person can do, and which they are currently an understudy for. Never shown to
 * staff, never affects the roster: purely a record supervisors keep (spec: staff proficiency). */
function ProficiencyEditor({ staffId, tasks, levels }: { staffId: string; tasks: TaskOption[]; levels: Record<string, ProficiencyLevel> }) {
  const { pending, run } = useAction();
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Only supervisors and Management see this. It does not affect the roster: it just records who is trained for which Task.</p>
      {tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground">No Tasks yet. Management adds Tasks on the Tasks page.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tasks.map((t) => {
            const level = levels[t.id] ?? "NONE";
            return (
              <div key={t.id} className="flex items-center gap-1 rounded-md border bg-background px-2 py-1">
                <span className="text-xs font-medium">{t.name}</span>
                {(["NONE", "UNDERSTUDY", "PROFICIENT"] as const).map((lv) => (
                  <button
                    key={lv}
                    type="button"
                    disabled={pending}
                    aria-pressed={level === lv}
                    title={LEVEL_LABEL[lv]}
                    onClick={() => run(() => setStaffProficiency({ staffId, taskId: t.id, level: lv }))}
                    className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", level === lv ? LEVEL_STYLE[lv] : "text-muted-foreground hover:bg-accent")}
                  >
                    {LEVEL_LABEL[lv]}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
