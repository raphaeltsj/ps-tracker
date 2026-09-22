import { notFound } from "next/navigation";
import { TaskManager } from "@/components/tasks/task-manager";
import { requireViewer } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageTasks } from "@/lib/permissions";

export const metadata = { title: "Tasks | PS Tracker" };

export default async function TasksPage() {
  const viewer = await requireViewer();
  if (!canManageTasks(viewer)) notFound(); // not visible to other roles

  const tasks = await db.task.findMany({ orderBy: { createdAt: "asc" }, include: { assignments: { select: { staffId: true, date: true } } } });
  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">Tasks</h1>
        <p className="text-sm text-muted-foreground">
          Name only, up to 6 characters including spaces. Tasks are informational and never affect duty, leave or strength.
        </p>
      </div>
      <TaskManager
        tasks={tasks.map((t) => ({
          id: t.id,
          name: t.name,
          assignments: t.assignments.length,
          people: new Set(t.assignments.map((a) => a.staffId)).size,
          dates: new Set(t.assignments.map((a) => a.date)).size,
        }))}
      />
    </main>
  );
}
