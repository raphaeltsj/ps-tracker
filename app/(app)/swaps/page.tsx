import { SwapForm } from "@/components/swaps/swap-form";
import { SwapFeedbackProvider, SwapList } from "@/components/swaps/swap-list";
import { requireViewer } from "@/lib/auth";
import { todayLocal } from "@/lib/dates";
import { db } from "@/lib/db";
import { canEditShift, canRequestLeave, hasEditView } from "@/lib/permissions";
import { getSwapsFor } from "@/lib/swap-data";

export const metadata = { title: "Duty swaps | PS Tracker" };

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

/** Duty swaps (spec 11.4): request or record a swap, answer as partner, approve as supervisor. */
export default async function SwapsPage() {
  const viewer = await requireViewer();
  const today = todayLocal();
  const [swaps, staff] = await Promise.all([
    getSwapsFor(viewer),
    db.staff.findMany({ where: { active: true, role: { not: "MANAGEMENT" }, shiftId: { not: null } }, orderBy: [{ shiftId: "asc" }, { name: "asc" }] }),
  ]);
  const people = staff.map((s) => ({ id: s.id, name: s.name, shiftId: s.shiftId! }));
  const supervised = people.filter((p) => canEditShift(viewer, p.shiftId));

  const needsMe = swaps.filter((s) => s.can.respond || s.can.approve);
  const mine = swaps.filter((s) => !needsMe.includes(s) && (s.requester.id === viewer.id || s.partner.id === viewer.id));
  const shiftSwaps = swaps.filter((s) => !needsMe.includes(s) && !mine.includes(s));
  // Active first (earliest date first), then the recent history.
  const order = (list: typeof swaps) =>
    [...list].sort((a, b) => Number(b.status === "APPROVED" || b.status.startsWith("PENDING")) - Number(a.status === "APPROVED" || a.status.startsWith("PENDING")) || a.dates[0].localeCompare(b.dates[0]));

  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">Duty swaps</h1>
        <p className="text-sm text-muted-foreground">
          Two people exchange duties one for one on a date: each works the other&apos;s duty. Strength, leave and Tasks stay the same. Approved swaps show on the roster with a ⇄ tag.
        </p>
      </div>

      <SwapFeedbackProvider>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-4">
            <Section title="Needs your action" note="Requests waiting for your answer, and swaps waiting for your approval (earliest submitted first).">
              <SwapList swaps={needsMe} viewerId={viewer.id} empty="Nothing waiting for you." />
            </Section>
            {canRequestLeave(viewer) && (
              <Section title="My swaps">
                <SwapList swaps={order(mine)} viewerId={viewer.id} empty="No swaps yet." />
              </Section>
            )}
            {hasEditView(viewer) && (
              <Section title={viewer.role === "MANAGEMENT" ? "All shifts' swaps" : `Shift ${viewer.shiftId} swaps`} note="Swaps with a date from today on. Past swaps drop off this list; the roster still shows who worked what.">
                <SwapList swaps={order(shiftSwaps)} viewerId={viewer.id} empty="No other swaps." />
              </Section>
            )}
          </div>

          <div className="space-y-4">
            {canRequestLeave(viewer) && (
              <Section title="Request a swap">
                <SwapForm mode="request" viewerId={viewer.id} firstPeople={[]} today={today} />
              </Section>
            )}
            {hasEditView(viewer) && (
              <Section title="Record a swap">
                <SwapForm mode="record" viewerId={viewer.id} firstPeople={supervised} today={today} />
              </Section>
            )}
          </div>
        </div>
      </SwapFeedbackProvider>
    </main>
  );
}
