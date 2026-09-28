import { notFound } from "next/navigation";
import { LeaveInbox } from "@/components/requests/leave-inbox";
import { SwapFeedbackProvider, SwapList } from "@/components/swaps/swap-list";
import { requireViewer } from "@/lib/auth";
import { canEditShift, hasEditView } from "@/lib/permissions";
import { getProficiencySummaries } from "@/lib/proficiency";
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

  const swapStaffIds = [...new Set(notMine.flatMap((s) => [s.requester.id, s.partner.id]))];
  const proficiencyByStaff = await getProficiencySummaries(swapStaffIds);

  return (
    <SwapFeedbackProvider>
      <main className="mx-auto w-full max-w-6xl space-y-4 p-4 pb-24 lg:pb-6">
        <div>
          <h1 className="text-xl font-semibold">Manage requests</h1>
          <p className="text-sm text-muted-foreground">
            Leave and duty swap requests for {viewer.role === "MANAGEMENT" ? "every shift" : `Shift ${viewer.shiftId}`}. Your own requests are on My Requests. Record a swap from the Roster.
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Section title="Leave requests" note="Earliest submitted first.">
              <LeaveInbox leaves={pendingLeaves} empty="Nothing pending." />
            </Section>
          </div>
          <div className="space-y-4 lg:col-span-3">
            <Section title="Duty swaps needing your approval">
              <SwapList swaps={order(needsApproval)} viewerId={viewer.id} empty="Nothing waiting for you." proficiencyByStaff={proficiencyByStaff} />
            </Section>
            <Section title={viewer.role === "MANAGEMENT" ? "All shifts' swaps" : `Shift ${viewer.shiftId} swaps`} note="Swaps with a date from today on; past swaps drop off this list.">
              <SwapList swaps={order(otherSwaps)} viewerId={viewer.id} empty="No other swaps." proficiencyByStaff={proficiencyByStaff} />
            </Section>
          </div>
        </div>
      </main>
    </SwapFeedbackProvider>
  );
}
