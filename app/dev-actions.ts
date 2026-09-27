"use server";
// TEMPORARY developer tool: clears the whole roster so the system can be tested from a blank slate.
// Delete this file, components/dev-clear-roster.tsx and their use in components/app-header.tsx to remove it.
// It refuses to run in production.
import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ActionResult } from "./actions";

export async function devClearRoster(): Promise<ActionResult> {
  if (process.env.NODE_ENV === "production") return { ok: false, error: "This developer tool is switched off in production." };
  const viewer = await requireViewer();
  if (viewer.role === "STAFF") return { ok: false, error: "Only supervisors and Management can clear the roster." };

  // Staff, shifts, dayworkers, the Task list and the leave types stay. Everything placed on a date goes.
  const [duties, dos, leaves, tasks, locks, events, ops, extra] = await db.$transaction([
    db.dutyOverride.deleteMany(), // V, V(SB), Off(V): the roster falls back to the plain cycle
    db.extraDuty.deleteMany(), // DOS / DOS2IC / FDO
    db.leave.deleteMany(), // all requests and leave (their days and the automatic 0.5 OIL go too)
    db.taskAssignment.deleteMany(),
    db.lockedDate.deleteMany(),
    db.specialEvent.deleteMany(),
    db.opsDuty.deleteMany(),
    db.extraShiftDuty.deleteMany(),
    db.dutySwap.deleteMany(), // duty swaps and their dates
  ]);

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `Roster cleared: ${duties.count} duties, ${dos.count} DOS/FDO, ${leaves.count} leave records, ${tasks.count} Task assignments, ${locks.count} locked dates, ${events.count} special events, ${ops.count} Ops duty, ${extra.count} Extra.`,
  };
}
