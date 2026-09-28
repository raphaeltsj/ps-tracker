"use client";
// A pending leave request, for supervisors and Management to approve or reject (Manage requests page).
// Sorted earliest submitted first by the caller (spec 12.3).
import { useState } from "react";
import { approveLeave, rejectLeave } from "@/app/actions";
import { LeaveChip } from "@/components/roster/chips";
import { ResultMessage, useAction } from "@/components/roster/use-action";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatDateList, formatDateTime } from "@/lib/dates";
import type { LeaveSummary } from "@/lib/roster-types";

export function LeaveInbox({ leaves, empty }: { leaves: LeaveSummary[]; empty: string }) {
  if (leaves.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;

  // Management sees every shift's requests in one inbox; group them by shift so one shift's
  // backlog doesn't bury another's, while keeping each group in the earliest-submitted-first
  // order already applied to the full list. A supervisor's own shift never has more than one
  // shiftId, so their inbox renders exactly as before.
  const shiftIds = [...new Set(leaves.map((l) => l.shiftId).filter((v): v is string => v !== null))].sort();
  if (shiftIds.length <= 1) {
    return (
      <ul className="space-y-2">
        {leaves.map((l) => (
          <LeaveInboxRow key={l.id} leave={l} />
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-4">
      {shiftIds.map((shiftId) => {
        const items = leaves.filter((l) => l.shiftId === shiftId);
        return (
          <div key={shiftId} className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground">
              Shift {shiftId} <span className="font-normal">({items.length})</span>
            </h3>
            <ul className="space-y-2">
              {items.map((l) => (
                <LeaveInboxRow key={l.id} leave={l} showShift={false} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function LeaveInboxRow({ leave, showShift = true }: { leave: LeaveSummary; showShift?: boolean }) {
  const { pending, result, run } = useAction();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <li className="space-y-2 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{leave.staffName}</span>
        {showShift && leave.shiftId && <span className="text-xs text-muted-foreground">Shift {leave.shiftId}</span>}
        <LeaveChip absence={{ code: leave.typeCode, half: leave.half, status: leave.status, counts: 1, derived: false }} />
        <span className="font-medium">{leave.typeName}</span>
        <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(leave.submittedAt)}</span>
      </div>
      <p className="text-xs">
        {formatDateList(leave.days)}
        {leave.half && ` (${leave.half === "FIRST" ? "first" : "second"} half)`}
      </p>
      {leave.notes && <p className="text-xs">Notes: {leave.notes}</p>}

      {!rejecting ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={pending || Boolean(leave.noSlotOn)} onClick={() => run(() => approveLeave(leave.id))}>
            Approve
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setRejecting(true)}>
            Reject
          </Button>
          {leave.noSlotOn && <span className="text-xs font-medium text-red-700 dark:text-red-300">No slot available on {formatDate(leave.noSlotOn)}</span>}
        </div>
      ) : (
        <div className="space-y-2">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Reason (required)" />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" disabled={pending || !reason.trim()} onClick={() => run(() => rejectLeave(leave.id, reason), () => setRejecting(false))}>
              Confirm reject
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
              Back
            </Button>
          </div>
        </div>
      )}
      <ResultMessage result={result} />
    </li>
  );
}
