"use client";
import { createContext, useContext, useState } from "react";
import { ArrowLeftRight, Check, Clock } from "lucide-react";
import { approveSwap, cancelSwap, rejectSwap, respondSwap, withdrawSwap } from "@/app/swap-actions";
import { DutyChip } from "@/components/roster/chips";
import { ResultMessage, useAction } from "@/components/roster/use-action";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDateShort, formatDateTime } from "@/lib/dates";
import { DUTY_LABEL } from "@/lib/domain";
import type { SwapSummary } from "@/lib/swap-data";
import { SWAP_STATUS_LABEL, type SwapStatus } from "@/lib/swaps";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<SwapStatus, string> = {
  PENDING_PARTNER: "bg-amber-100 text-amber-900 dark:bg-amber-400/20 dark:text-amber-200",
  PENDING_APPROVAL: "bg-amber-100 text-amber-900 dark:bg-amber-400/20 dark:text-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-900 dark:bg-emerald-400/20 dark:text-emerald-200",
  DECLINED: "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200",
  REJECTED: "bg-red-100 text-red-900 dark:bg-red-400/20 dark:text-red-200",
  WITHDRAWN: "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200",
  CANCELLED: "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200",
  EXPIRED: "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200",
};

export function SwapStatusBadge({ status }: { status: SwapStatus }) {
  return <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap", STATUS_STYLE[status])}>{SWAP_STATUS_LABEL[status]}</span>;
}

/**
 * Page-level confirmation. Approving or answering a swap moves its card to another section (a new
 * component), which would wipe a message kept on the card, so successes are shown here instead.
 */
const Feedback = createContext<(message: string) => void>(() => {});

export function SwapFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <Feedback.Provider value={setMessage}>
      {message && (
        <div role="status" className="sticky top-16 z-30 flex items-start gap-2 rounded-lg border border-emerald-600/40 bg-emerald-50 p-3 text-sm text-emerald-900 shadow-sm dark:bg-emerald-500/15 dark:text-emerald-100">
          <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="flex-1">{message}</span>
          <button type="button" className="text-xs underline underline-offset-2" onClick={() => setMessage(null)}>
            Dismiss
          </button>
        </div>
      )}
      {children}
    </Feedback.Provider>
  );
}

export function SwapList({ swaps, viewerId, empty }: { swaps: SwapSummary[]; viewerId: string; empty: string }) {
  if (swaps.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-2">
      {swaps.map((s) => (
        <SwapCard key={s.id} swap={s} viewerId={viewerId} />
      ))}
    </ul>
  );
}

function SwapCard({ swap: s, viewerId }: { swap: SwapSummary; viewerId: string }) {
  const { pending, result: cardResult, run: runAction } = useAction();
  const announce = useContext(Feedback);
  // Successes go to the page banner (the card may move); errors stay on the card.
  const result = cardResult && !cardResult.ok ? cardResult : null;
  const run: typeof runAction = (action, onSuccess) =>
    runAction(async () => {
      const r = await action();
      if (r.ok && r.message) announce(r.message);
      return r;
    }, onSuccess);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const me = (id: string, name: string) => (id === viewerId ? "You" : name);
  const sameShift = s.requesterShiftId === s.partnerShiftId;
  const pendingState = s.status === "PENDING_PARTNER" || s.status === "PENDING_APPROVAL";

  return (
    <li className="space-y-2 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">
          {me(s.requester.id, s.requester.name)} <span className="font-normal text-muted-foreground">(Shift {s.requesterShiftId})</span>
        </span>
        <ArrowLeftRight className="size-3.5 text-muted-foreground" aria-label="swaps with" />
        <span className="font-semibold">
          {me(s.partner.id, s.partner.name)} <span className="font-normal text-muted-foreground">(Shift {s.partnerShiftId})</span>
        </span>
        <span className="ml-auto">
          <SwapStatusBadge status={s.status} />
        </span>
      </div>

      {/* Each date: what each person had before. After the swap they work each other's. */}
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-0.5 font-medium">Date</th>
            <th className="py-0.5 font-medium">
              {me(s.requester.id, s.requester.name)} ({s.requesterShiftId}) works
            </th>
            <th className="py-0.5 font-medium">
              {me(s.partner.id, s.partner.name)} ({s.partnerShiftId}) works
            </th>
          </tr>
        </thead>
        <tbody>
          {s.rows.map((r) => (
            <tr key={r.date} className="border-t">
              <td className="py-1 pr-2">{formatDateShort(r.date)}</td>
              <td className="py-1 pr-2">
                <span className="inline-flex items-center gap-1">
                  <DutyChip duty={r.partnerDuty} />
                  <span className="text-muted-foreground line-through decoration-1">{DUTY_LABEL[r.requesterDuty]}</span>
                </span>
              </td>
              <td className="py-1">
                <span className="inline-flex items-center gap-1">
                  <DutyChip duty={r.requesterDuty} />
                  <span className="text-muted-foreground line-through decoration-1">{DUTY_LABEL[r.partnerDuty]}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {s.recorded ? <span>Recorded by {s.createdByName}</span> : <span>Requested {formatDateTime(s.submittedAt)}</span>}
        {s.status !== "PENDING_PARTNER" && s.status !== "DECLINED" && !s.recorded && <span className="inline-flex items-center gap-1"><Check className="size-3" /> {s.partner.name} agreed</span>}
        {s.status === "PENDING_PARTNER" && <span className="inline-flex items-center gap-1"><Clock className="size-3" /> Waiting for {me(s.partner.id, s.partner.name) === "You" ? "your answer" : s.partner.name}</span>}
        {s.status === "PENDING_PARTNER" ? (
          <span>Then: {sameShift ? `the Shift ${s.requesterShiftId} supervisor approves` : `the Shift ${s.requesterShiftId} and Shift ${s.partnerShiftId} supervisors approve`}</span>
        ) : s.status === "DECLINED" || s.status === "WITHDRAWN" || s.status === "EXPIRED" ? null : sameShift ? (
          <SideState label={`Shift ${s.requesterShiftId}`} by={s.requesterSideBy} />
        ) : (
          <>
            <SideState label={`Shift ${s.requesterShiftId}`} by={s.requesterSideBy} />
            <SideState label={`Shift ${s.partnerShiftId}`} by={s.partnerSideBy} />
          </>
        )}
      </div>
      {s.notes && <p className="text-xs">Notes: {s.notes}</p>}
      {s.rejectReason && <p className="text-xs text-red-700 dark:text-red-300">Reject reason: {s.rejectReason}</p>}
      {s.status === "APPROVED" && s.started && <p className="text-xs text-muted-foreground">Started on {formatDateShort(s.dates[0])}, so it stays as worked and can no longer be cancelled.</p>}
      {s.problem && pendingState && <p className="rounded-md bg-red-50 p-2 text-xs font-medium text-red-800 dark:bg-red-500/10 dark:text-red-200">Cannot go through as things stand: {s.problem}</p>}

      {!rejecting && !confirmCancel && (s.can.respond || s.can.withdraw || s.can.approve || s.can.reject || s.can.cancel) && (
        <div className="flex flex-wrap gap-2">
          {s.can.respond && (
            <>
              <Button size="sm" disabled={pending || Boolean(s.problem)} onClick={() => run(() => respondSwap(s.id, true))}>
                Accept
              </Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => respondSwap(s.id, false))}>
                Decline
              </Button>
            </>
          )}
          {s.can.approve && (
            <Button size="sm" disabled={pending || Boolean(s.problem)} onClick={() => run(() => approveSwap(s.id))}>
              Approve
            </Button>
          )}
          {s.can.reject && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => setRejecting(true)}>
              Reject
            </Button>
          )}
          {s.can.withdraw && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => withdrawSwap(s.id))}>
              Withdraw
            </Button>
          )}
          {s.can.cancel && (
            <Button size="sm" variant="outline" className="text-red-700 dark:text-red-300" disabled={pending} onClick={() => setConfirmCancel(true)}>
              Cancel swap
            </Button>
          )}
        </div>
      )}
      {rejecting && (
        <div className="space-y-2">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Reason (required)" />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" disabled={pending || !reason.trim()} onClick={() => run(() => rejectSwap(s.id, reason), () => setRejecting(false))}>
              Confirm reject
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
              Back
            </Button>
          </div>
        </div>
      )}
      {confirmCancel && (
        <div className="space-y-2 rounded-md border border-red-300 p-2 dark:border-red-500/40">
          <p className="text-xs">Cancel this approved swap? Both people go back to their own duties on these dates.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" disabled={pending} onClick={() => run(() => cancelSwap(s.id), () => setConfirmCancel(false))}>
              Yes, cancel swap
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(false)}>
              Keep it
            </Button>
          </div>
        </div>
      )}
      <ResultMessage result={result} />
    </li>
  );
}

function SideState({ label, by }: { label: string; by: string | null }) {
  return by ? (
    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
      <Check className="size-3" /> {label} approved by {by}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1">
      <Clock className="size-3" /> {label} supervisor to approve
    </span>
  );
}
