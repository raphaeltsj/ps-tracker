"use client";
// TEMPORARY developer tool (see app/dev-actions.ts). Remove with that file.
import { useState } from "react";
import { Eraser } from "lucide-react";
import { devClearRoster } from "@/app/dev-actions";
import { useAction } from "@/components/roster/use-action";
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

export function DevClearRoster() {
  const { pending, result, run } = useAction();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="border-dashed border-danger/60 text-danger-ink"
        disabled={pending}
        onClick={() => setOpen(true)}
        title="Developer tool: clears every duty, leave, Task assignment, lock, event, Ops duty and Extra"
      >
        <Eraser className="size-4" />
        <span className="hidden md:inline">{pending ? "Clearing..." : "Clear roster (dev)"}</span>
      </Button>
      {result && (
        <span role="status" className={result.ok ? "sr-only" : "text-xs font-medium text-danger-ink"}>
          {result.ok ? result.message : result.error}
        </span>
      )}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear the entire roster?</AlertDialogTitle>
            <AlertDialogDescription>
              Developer tool. This deletes, for every shift: set duties (V, V(SB), Off(V)), DOS/FDO, all leave and requests, Task assignments, locked dates, special events, Ops duty and Extra.
              Staff, dayworkers, the Task list and the leave types are kept. To get the demo data back, run &quot;npm run db:seed&quot;. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => run(() => devClearRoster())}>
              Clear everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
