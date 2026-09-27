"use client";
import { useState } from "react";
import { MyRequests } from "@/components/roster/my-requests";
import { SwapList } from "@/components/swaps/swap-list";
import type { Viewer } from "@/lib/permissions";
import type { LeaveSummary } from "@/lib/roster-types";
import type { SwapSummary } from "@/lib/swap-data";
import { cn } from "@/lib/utils";

type Filter = "all" | "pending" | "approved" | "rejected";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

const LEAVE_BUCKET: Partial<Record<LeaveSummary["status"], Filter>> = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

const SWAP_BUCKET: Partial<Record<SwapSummary["status"], Filter>> = {
  PENDING_PARTNER: "pending",
  PENDING_APPROVAL: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  DECLINED: "rejected",
};

/**
 * Leave requests and duty swaps the viewer has made, with a shared status filter. Withdrawn ones
 * never show: once withdrawn there is nothing left to track. "All" still includes statuses with no
 * Pending/Approved/Rejected bucket (Cancelled, Expired).
 */
export function RequestsHistory({ leaves, swaps, viewer }: { leaves: LeaveSummary[]; swaps: SwapSummary[]; viewer: Viewer }) {
  const [filter, setFilter] = useState<Filter>("all");
  const activeLeaves = leaves.filter((l) => l.status !== "WITHDRAWN");
  const activeSwaps = swaps.filter((s) => s.status !== "WITHDRAWN");
  const nothingYet = activeLeaves.length === 0 && activeSwaps.length === 0;

  const visibleLeaves = activeLeaves.filter((l) => filter === "all" || LEAVE_BUCKET[l.status] === filter);
  const visibleSwaps = activeSwaps.filter((s) => filter === "all" || SWAP_BUCKET[s.status] === filter);
  const filterLabel = FILTERS.find((f) => f.key === filter)!.label.toLowerCase();

  return (
    <section className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Your requests</h2>
        {!nothingYet && (
          <div className="flex rounded-lg border p-0.5 text-xs" role="tablist" aria-label="Filter by status">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={cn("rounded-md px-2.5 py-1", filter === f.key ? "bg-secondary font-semibold" : "text-muted-foreground")}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {nothingYet ? (
        <p className="text-sm text-muted-foreground">Nothing yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">Leave requests</h3>
            <MyRequests leaves={visibleLeaves} viewer={viewer} empty={`No ${filter === "all" ? "" : `${filterLabel} `}leave requests.`} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">Duty swaps</h3>
            <SwapList swaps={visibleSwaps} viewerId={viewer.id} empty={`No ${filter === "all" ? "" : `${filterLabel} `}swaps.`} />
          </div>
        </div>
      )}
    </section>
  );
}
