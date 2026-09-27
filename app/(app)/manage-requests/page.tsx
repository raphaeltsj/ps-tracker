import { notFound } from "next/navigation";
import { LeaveInbox } from "@/components/requests/leave-inbox";
import { SwapList } from "@/components/swaps/swap-list";
import { requireViewer } from "@/lib/auth";
import { canEditShift, hasEditView } from "@/lib/permissions";
import { getPendingLeaves } from "@/lib/roster-data";
import { getSwapsFor } from "@/lib/swap-data";

export const metadata = { title: "Manage requests | PS Tracker" };

const SHIFT_IDS = ["A", "B", "C"];

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}

/** Status and review only: approve/reject leave, approve/reject/cancel duty swaps. Recording a swap,
 * like requesting one, is done from the Roster (spec 11.4), alongside the shift it's for. */
export default async function ManageRequestsPage() {
  const viewer = await requireViewer();
  if (!hasEditView(viewer)) notFound();

  const editableShifts = SHIFT_IDS.filter((id) => canEditShift(viewer, id));

  const [pendingLeaves, swaps] = await Promise.all([
    getPendingLeaves(editableShifts, viewer.role === "SUPERVISOR" ? viewer.id : undefined),
    getSwapsFor(viewer),
  ]);

  // A supervisor's own swap is self-service on My Requests, not something to review here.
  const notMine = swaps.filter((s) => s.requester.id !== viewer.id && s.partner.id !== viewer.id);
  const needsApproval = notMine.filter((s) => s.can.approve);
  const otherSwaps = notMine.filter((s) => !needsApproval.includes(s));
  const order = (list: typeof swaps) =>
    [...list].sort(
      (a, b) => Number(b.status === "APPROVED" || b.status.startsWith("PENDING")) - Number(a.status === "APPROVED" || a.status.startsWith("PENDING")) || a.dates[0].localeCompare(b.dates[0]),
    );

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 p-4 pb-24 lg:pb-6">
      <div>
        <h1 className="text-xl font-semibold">Manage requests</h1>
        <p className="text-sm text-muted-foreground">
          Leave and duty swap requests for {viewer.role === "MANAGEMENT" ? "every shift" : `Shift ${viewer.shiftId}`}. Your own requests are on My Requests. Record a swap from the Roster.
        </p>
      </div>

      <Section title="Leave requests" note="Earliest submitted first.">
        <LeaveInbox leaves={pendingLeaves} empty="Nothing pending." />
      </Section>
      <Section title="Duty swaps needing your approval">
        <SwapList swaps={order(needsApproval)} viewerId={viewer.id} empty="Nothing waiting for you." />
      </Section>
      <Section title={viewer.role === "MANAGEMENT" ? "All shifts' swaps" : `Shift ${viewer.shiftId} swaps`} note="Pending and approved swaps, and the last 60 days of history.">
        <SwapList swaps={order(otherSwaps)} viewerId={viewer.id} empty="No other swaps." />
      </Section>
    </main>
  );
}
