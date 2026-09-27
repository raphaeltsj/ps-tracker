"use client";
import { useState } from "react";
import { createDayworker, setDayworkerActive, updateDayworker } from "@/app/actions";
import { OpsChip } from "@/components/roster/chips";
import { ResultMessage, useAction } from "@/components/roster/use-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateList } from "@/lib/dates";
import { DAYWORKER_NAME_MAX, DAYWORKER_USERNAME_MAX, type DayworkerReportRow } from "@/lib/dayworkers";
import { cn } from "@/lib/utils";

const SHIFTS = ["A", "B", "C"];

function UsernameInput({ value, onChange, label, id }: { value: string; onChange: (v: string) => void; label: string; id: string }) {
  const over = value.trim().length > DAYWORKER_USERNAME_MAX;
  return (
    <div className="flex items-center gap-2">
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={cn("w-32 uppercase", over && "border-red-500")} />
      <span className={cn("w-10 text-xs tabular-nums", over ? "font-semibold text-red-600" : "text-muted-foreground")} aria-live="polite">
        {value.trim().length}/{DAYWORKER_USERNAME_MAX}
      </span>
    </div>
  );
}

const validUsername = (v: string) => v.trim().length > 0 && v.trim().length <= DAYWORKER_USERNAME_MAX && !/\s/.test(v.trim());

/** Add and edit dayworkers, and see how many days each clocked shift duty in the chosen period. */
export function DayworkerManager({ rows, countedUntil }: { rows: DayworkerReportRow[]; countedUntil: string }) {
  const { pending, result, run } = useAction();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");

  const total = rows.reduce((sum, r) => sum + r.total, 0);

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-3 rounded-xl border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => createDayworker({ name, username }),
            () => {
              setName("");
              setUsername("");
            },
          );
        }}
      >
        <label className="space-y-1" htmlFor="dw-name">
          <span className="block text-xs font-medium text-muted-foreground">Name</span>
          <Input id="dw-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={DAYWORKER_NAME_MAX} className="w-48" placeholder="Full name" />
        </label>
        <div className="space-y-1">
          <label htmlFor="dw-username" className="block text-xs font-medium text-muted-foreground">
            Username (shown on the roster)
          </label>
          <UsernameInput id="dw-username" value={username} onChange={setUsername} label="Username" />
        </div>
        <Button type="submit" disabled={pending || name.trim().length === 0 || !validUsername(username)}>
          Add dayworker
        </Button>
        <p className="w-full text-xs text-muted-foreground">
          Up to {DAYWORKER_USERNAME_MAX} characters, no spaces, shown in capitals. Dayworkers are not part of a shift crew: their shift duty is Ops duty, assigned on the roster.
        </p>
      </form>
      <ResultMessage result={result} />

      <p className="text-sm">
        <span className="font-medium">{total} Ops duty day{total === 1 ? "" : "s"}</span>
        <span className="text-muted-foreground"> counted up to {countedUntil}</span>
      </p>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="bg-muted/50 text-left">
              <th className="border-b px-3 py-2 font-semibold">Username</th>
              <th className="border-b px-3 py-2 font-semibold">Name</th>
              {SHIFTS.map((s) => (
                <th key={s} className="border-b px-3 py-2 text-right font-semibold">
                  Shift {s}
                </th>
              ))}
              <th className="border-b px-3 py-2 text-right font-semibold">Total</th>
              <th className="border-b px-3 py-2 text-right font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const editing = editingId === r.id;
              return (
                <tr key={r.id} className={cn("align-top", !r.active && "text-muted-foreground")}>
                  <td className="border-b px-3 py-2">
                    {editing ? (
                      <UsernameInput id={`edit-username-${r.id}`} value={editUsername} onChange={setEditUsername} label={`Username for ${r.name}`} />
                    ) : (
                      <span className="flex items-center gap-2">
                        <OpsChip entry={{ dayworkerId: r.id, username: r.username, name: r.name, active: r.active }} />
                        {!r.active && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">Inactive</span>}
                      </span>
                    )}
                  </td>
                  <td className="border-b px-3 py-2">
                    {editing ? (
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={DAYWORKER_NAME_MAX} aria-label={`Name for ${r.username}`} className="w-48" />
                    ) : r.total > 0 ? (
                      <details>
                        <summary className="cursor-pointer font-medium whitespace-nowrap">{r.name}</summary>
                        {/* The dates behind the count, per shift */}
                        <ul className="mt-1 max-h-40 max-w-72 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
                          {SHIFTS.filter((s) => r.byShift[s]).map((s) => (
                            <li key={s}>
                              <span className="font-medium text-foreground">Shift {s}:</span> {formatDateList(r.days.filter((d) => d.shiftId === s).map((d) => d.date))}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : (
                      <span className="font-medium">{r.name}</span>
                    )}
                  </td>
                  {SHIFTS.map((s) => (
                    <td key={s} className={cn("border-b px-3 py-2 text-right tabular-nums", !r.byShift[s] && "text-muted-foreground/50")}>
                      {r.byShift[s] ?? "–"}
                    </td>
                  ))}
                  <td className="border-b px-3 py-2 text-right font-semibold tabular-nums">{r.total}</td>
                  <td className="border-b px-3 py-2 text-right">
                    <span className="flex justify-end gap-1">
                      {editing ? (
                        <>
                          <Button
                            size="sm"
                            disabled={pending || editName.trim().length === 0 || !validUsername(editUsername)}
                            onClick={() => run(() => updateDayworker({ id: r.id, name: editName, username: editUsername }), () => setEditingId(null))}
                          >
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(r.id);
                              setEditName(r.name);
                              setEditUsername(r.username);
                            }}
                          >
                            Edit
                          </Button>
                          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setDayworkerActive(r.id, !r.active))}>
                            {r.active ? "Deactivate" : "Reactivate"}
                          </Button>
                        </>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={SHIFTS.length + 4} className="px-3 py-6 text-center text-muted-foreground">
                  No dayworkers yet. Add the first one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
