"use client";
import { approveLeave, withdrawLeave } from "@/app/actions";
import { StatusBadge } from "@/components/roster/chips";
import { ResultMessage, useAction } from "@/components/roster/use-action";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateList } from "@/lib/dates";
import type { Viewer } from "@/lib/permissions";
import type { LeaveSummary } from "@/lib/roster-types";

/** The viewer's own requests with status; Withdraw for pending; supervisors can approve their own. */
export function MyRequests({ leaves, viewer, onSelect }: { leaves: LeaveSummary[]; viewer: Viewer; onSelect?: (id: string) => void }) {
  const { pending, result, run } = useAction();
  if (leaves.length === 0) return <p className="text-sm text-muted-foreground">No requests yet.</p>;

  return (
    <div className="space-y-2">
      <ResultMessage result={result} />
      <ul className="space-y-2">
        {leaves.map((l) => (
          <li key={l.id} className="rounded-lg border p-2.5 text-sm">
            <button type="button" className="flex w-full items-start justify-between gap-2 text-left" onClick={() => onSelect?.(l.id)}>
              <span>
                <span className="font-semibold">{l.typeCode}</span>
                {l.half && <span className="text-muted-foreground"> ({l.half === "FIRST" ? "1st" : "2nd"} half)</span>}
                <span className="block text-xs text-muted-foreground">{formatDateList(l.days)}</span>
              </span>
              <StatusBadge status={l.status} />
            </button>
            {l.givenByName && <p className="mt-1 text-xs text-muted-foreground">Given by {l.givenByName} (already approved)</p>}
            {l.notes && <p className="mt-1 text-xs">Notes: {l.notes}</p>}
            {l.remarks && <p className="mt-1 text-xs">Remarks: {l.remarks}</p>}
            {l.rejectReason && <p className="mt-1 text-xs text-red-700 dark:text-red-300">Reason: {l.rejectReason}</p>}
            {l.status === "PENDING" && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => withdrawLeave(l.id))}>
                  Withdraw
                </Button>
                {viewer.role === "SUPERVISOR" && (
                  <>
                    <Button size="sm" disabled={pending || Boolean(l.noSlotOn)} onClick={() => run(() => approveLeave(l.id))}>
                      Approve my request
                    </Button>
                    {l.noSlotOn && <span className="text-xs text-red-700 dark:text-red-300">No slot available on {formatDate(l.noSlotOn)}</span>}
                  </>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
