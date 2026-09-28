import "server-only";
import { db } from "@/lib/db";

/** "PROFICIENT": can do the Task. "UNDERSTUDY" ("(U/S)"): currently training for it. Never shown to
 * staff and never affects the roster: a record supervisors keep of who is trained for what. */
export type ProficiencyLevel = "NONE" | "PROFICIENT" | "UNDERSTUDY";

/** staffId -> taskId -> level, for every staff member on a shift at once (the Staff page). */
export type ProficiencyMap = Record<string, Record<string, ProficiencyLevel>>;

export async function getProficiencyMap(staffIds: string[]): Promise<ProficiencyMap> {
  if (staffIds.length === 0) return {};
  const rows = await db.staffTaskProficiency.findMany({ where: { staffId: { in: staffIds } } });
  const map: ProficiencyMap = {};
  for (const r of rows) (map[r.staffId] ??= {})[r.taskId] = r.understudy ? "UNDERSTUDY" : "PROFICIENT";
  return map;
}

export type ProficiencyEntry = { taskName: string; understudy: boolean };

/** Proficient/understudy Task names for a handful of people at once, for comparing duty-swap partners. */
export async function getProficiencySummaries(staffIds: string[]): Promise<Record<string, ProficiencyEntry[]>> {
  if (staffIds.length === 0) return {};
  const rows = await db.staffTaskProficiency.findMany({
    where: { staffId: { in: staffIds } },
    include: { task: true },
    orderBy: { task: { createdAt: "asc" } },
  });
  const out: Record<string, ProficiencyEntry[]> = {};
  for (const r of rows) (out[r.staffId] ??= []).push({ taskName: r.task.name, understudy: r.understudy });
  return out;
}
