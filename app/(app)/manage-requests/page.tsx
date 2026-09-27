import { notFound } from "next/navigation";
import { LeaveInbox } from "@/components/requests/leave-inbox";
import { SwapForm } from "@/components/swaps/swap-form";
import { SwapList } from "@/components/swaps/swap-list";
import { requireViewer } from "@/lib/auth";
import { todayLocal } from "@/lib/dates";
import { db } from "@/lib/db";
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

/** Supervisors and Management: review leave and duty swap requests for the shifts they edit. */
export default async function ManageRequestsPage() {
  const viewer = await requireViewer();
  if (!hasEditView(viewer)) notFound();

  const today = todayLocal();
  const editableShifts = SHIFT_IDS.filter((id) => canEditShift(viewer, id));

  const [pendingLeaves, swaps, staff] = await Promise.all([
    getPendingLeaves(editableShifts, viewer.role === "SUPERVISOR" ? viewer.id : undefined),
    getSwapsFor(viewer),
    db.staff.findMany({ where: { active: true, role: { not: "MANAGEMENT" }, shiftId: { not: null } }, orderBy: [{ shiftId: "asc" }, { name: "asc" }] }),
  ]);
  const people = staff.map((s) => ({ id: s.id, name: s.name, shiftId: s.shiftId! }));
  const supervised = people.filter((p) => canEditShift(viewer, p.shiftId));

  // A supervisor's own swap is self-service on My Requests, not something to review here.
  const notMine = swaps.filter((s) => s.requester.id !== viewer.id && s.partner.id !== viewer.id);
  const needsApproval = notMine.filter((s) => s.can.approve);
  const otherSwaps = notMine.filter((s) => !needsApproval.includes(s));
  const order = (list: typeof swaps) =>
    [...list].sort(
      (a, b) => Number(b.status === "APPROVED" || b.status.startsWith("PENDING")) - Number(a.status === "APPROVED" || a.status.startsWith("PENDING")) || a.dates[0].localeCompare(b.dates[0]),
    );

  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 p-4 pb-24 lg:pb-6">
      <div>
        <h1 className="text-xl font-semibold">Manage requests</h1>
        <p className="text-sm text-muted-foreground">
          Leave and duty swap requests for {viewer.role === "MANAGEMENT" ? "every shift" : `Shift ${viewer.shiftId}`}. Your own requests are on My Requests.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <Section title="Leave requests" note="Earliest submitted first.">
            <LeaveInbox leaves={pendingLeaves} empty="Nothing pending." />
          </Section>
          <Section title="Duty swaps needing your approval">
            <SwapList swaps={order(needsApproval)} viewerId={viewer.id} empty="Nothing waiting for you." />
          </Section>
          <Section title={viewer.role === "MANAGEMENT" ? "All shifts' swaps" : `Shift ${viewer.shiftId} swaps`} note="Pending and approved swaps, and the last 60 days of history.">
            <SwapList swaps={order(otherSwaps)} viewerId={viewer.id} empty="No other swaps." />
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Record a swap">
            <SwapForm mode="record" viewerId={viewer.id} firstPeople={supervised} partners={people} today={today} />
          </Section>
        </div>
      </div>
    </main>
  );
}
