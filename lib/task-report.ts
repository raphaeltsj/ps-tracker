import "server-only";
import { db } from "@/lib/db";

export type TaskReportRow = {
  staffId: string;
  name: string;
  shiftId: string;
  role: string;
  counts: Record<string, number>; // taskId -> number of days
  total: number;
};

export type TaskReport = {
  tasks: { id: string; name: string }[];
  rows: TaskReportRow[];
  taskTotals: Record<string, number>;
  taskPeople: Record<string, number>;
  total: number;
};

/**
 * How many days each person held each Task in [from, to]. Tasks are informational only, so this is
 * purely a count of assignments. Deleted Tasks take their assignments with them.
 */
export async function getTaskReport(from: string, to: string, shiftIds: string[], taskIds: string[] | null = null): Promise<TaskReport> {
  const [tasks, staff, assignments] = await Promise.all([
    db.task.findMany({
      where: taskIds ? { id: { in: taskIds } } : undefined,
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    db.staff.findMany({
      where: { shiftId: { in: shiftIds }, active: true, role: { not: "MANAGEMENT" } },
      orderBy: [{ shiftId: "asc" }, { role: "desc" }, { name: "asc" }],
    }),
    from <= to
      ? db.taskAssignment.findMany({
          where: {
            date: { gte: from, lte: to },
            staff: { shiftId: { in: shiftIds } },
            taskId: taskIds ? { in: taskIds } : undefined,
          },
          select: { taskId: true, staffId: true },
        })
      : Promise.resolve([]),
  ]);

  const rows = new Map<string, TaskReportRow>(
    staff.map((s) => [s.id, { staffId: s.id, name: s.name, shiftId: s.shiftId!, role: s.role, counts: {}, total: 0 }]),
  );
  const taskTotals: Record<string, number> = {};
  const people: Record<string, Set<string>> = {};
  for (const a of assignments) {
    const row = rows.get(a.staffId);
    if (!row) continue; // inactive staff
    row.counts[a.taskId] = (row.counts[a.taskId] ?? 0) + 1;
    row.total++;
    taskTotals[a.taskId] = (taskTotals[a.taskId] ?? 0) + 1;
    (people[a.taskId] ??= new Set()).add(a.staffId);
  }

  return {
    tasks,
    rows: [...rows.values()],
    taskTotals,
    taskPeople: Object.fromEntries(Object.entries(people).map(([id, set]) => [id, set.size])),
    total: Object.values(taskTotals).reduce((a, b) => a + b, 0),
  };
}

/** Years with any Task assignments, plus the current year. */
export async function taskReportYears(currentYear: number): Promise<number[]> {
  const [first, last] = await Promise.all([
    db.taskAssignment.findFirst({ orderBy: { date: "asc" }, select: { date: true } }),
    db.taskAssignment.findFirst({ orderBy: { date: "desc" }, select: { date: true } }),
  ]);
  const lo = Math.min(currentYear, first ? Number(first.date.slice(0, 4)) : currentYear);
  const hi = Math.max(currentYear, last ? Number(last.date.slice(0, 4)) : currentYear);
  return Array.from({ length: hi - lo + 1 }, (_, i) => hi - i);
}
