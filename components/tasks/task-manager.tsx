"use client";
import { useState } from "react";
import { createTask, deleteTask, renameTask } from "@/app/actions";
import { TaskTag } from "@/components/roster/chips";
import { ResultMessage, useAction } from "@/components/roster/use-action";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NAME_MAX } from "@/lib/domain";
import { cn } from "@/lib/utils";

type TaskRow = { id: string; name: string; assignments: number; people: number; dates: number };

function NameInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const over = value.length > NAME_MAX;
  return (
    <div className="flex items-center gap-2">
      <Input value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={cn("w-32", over && "border-danger")} />
      <span className={cn("w-10 text-xs tabular-nums", over ? "font-semibold text-danger-ink" : "text-muted-foreground")} aria-live="polite">
        {value.length}/{NAME_MAX}
      </span>
    </div>
  );
}

const validName = (v: string) => v.trim().length > 0 && v.length <= NAME_MAX;

export function TaskManager({ tasks }: { tasks: TaskRow[] }) {
  const { pending, result, run } = useAction();
  // Suggest the next name, kept within 6 characters: "Task 9", then "T10", "T11"...
  const [newName, setNewName] = useState(tasks.length < 9 ? `Task ${tasks.length + 1}` : `T${tasks.length + 1}`);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [toDelete, setToDelete] = useState<TaskRow | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
        <NameInput value={newName} onChange={setNewName} label="New Task name" />
        <Button disabled={pending || !validName(newName)} onClick={() => run(() => createTask(newName), () => setNewName(""))}>
          Add Task
        </Button>
        {newName.length > NAME_MAX && <span className="text-xs text-danger-ink">Too long. Try a shorter name such as &quot;T10&quot;.</span>}
      </div>
      <ResultMessage result={result} />

      <ul className="divide-y rounded-xl border">
        {tasks.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
            {editingId === t.id ? (
              <>
                <NameInput value={editName} onChange={setEditName} label={`Rename ${t.name}`} />
                <Button size="sm" disabled={pending || !validName(editName)} onClick={() => run(() => renameTask(t.id, editName), () => setEditingId(null))}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <TaskTag name={t.name} className="h-6 px-2 text-sm" />
                <span className="text-xs text-muted-foreground">
                  {t.assignments} assignment{t.assignments === 1 ? "" : "s"} ({t.people} people, {t.dates} dates)
                </span>
                <span className="ml-auto flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingId(t.id);
                      setEditName(t.name);
                    }}
                  >
                    Rename
                  </Button>
                  <Button size="sm" variant="outline" className="text-danger-ink" onClick={() => setToDelete(t)}>
                    Delete
                  </Button>
                </span>
              </>
            )}
          </li>
        ))}
        {tasks.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">No Tasks yet.</li>}
      </ul>

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              All existing assignments of this Task will be deleted: {toDelete?.assignments} assignment{toDelete?.assignments === 1 ? "" : "s"} across {toDelete?.people} people
              and {toDelete?.dates} dates. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Task</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                const t = toDelete!;
                run(() => deleteTask(t.id));
              }}
            >
              Delete Task and assignments
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
