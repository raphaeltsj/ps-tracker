import Link from "next/link";
import { MyRequests } from "@/components/roster/my-requests";
import { SwapForm } from "@/components/swaps/swap-form";
import { SwapList } from "@/components/swaps/swap-list";
import { requireViewer } from "@/lib/auth";
import { monthDates, todayLocal } from "@/lib/dates";
import { db } from "@/lib/db";
import { tallyLeaveTaken } from "@/lib/leave-report";
import { canDecideLeave, canRequestLeave } from "@/lib/permissions";
import { buildRoster, getMyLeaves } from "@/lib/roster-data";
import { firstDateWithoutSlot } from "@/lib/slots";
import { formatFigure } from "@/lib/strength";
import { getSwapsFor } from "@/lib/swap-data";
import { cn } from "@/lib/utils";

export const metadata = { title: "My Requests | PS Tracker" };

export default async function RequestsPage({ searchParams }: PageProps<"/requests">) {
  const viewer = await requireViewer();
  if (!canRequestLeave(viewer)) {
    return <main className="p-6 text-sm text-muted-foreground">Management does not request leave or duty swaps.</main>;
  }
  const params = await searchParams;
  const period = params.period === "year" ? "year" : "month";
  const today = todayLocal();
  const year = today.slice(0, 4);
  const month = today.slice(0, 7);
  const from = period === "year" ? `${year}-01-01` : `${month}-01`;
  const to = period === "year" ? `${year}-12-31` : monthDates(month).at(-1)!;

  const [leaves, swaps, roster, staff] = await Promise.all([
    getMyLeaves(viewer.id),
    getSwapsFor(viewer),
    buildRoster(viewer.shiftId!, from, to, viewer),
    db.staff.findMany({ where: { active: true, role: { not: "MANAGEMENT" }, shiftId: { not: null } }, orderBy: [{ shiftId: "asc" }, { name: "asc" }] }),
  ]);
  for (const l of leaves) {
    if (l.status === "PENDING" && canDecideLeave(viewer, l.staffId, l.shiftId)) l.noSlotOn = await firstDateWithoutSlot(l);
  }
  const { total, byType } = tallyLeaveTaken(roster.cells[viewer.id], roster.dates);
  const partners = staff.filter((s) => s.id !== viewer.id).map((s) => ({ id: s.id, name: s.name, shiftId: s.shiftId! }));

  const pendingLeaves = leaves.filter((l) => l.status === "PENDING");
  const mySwaps = swaps.filter((s) => s.requester.id === viewer.id || s.partner.id === viewer.id);
  const pendingSwaps = mySwaps.filter((s) => s.status === "PENDING_PARTNER" || s.status === "PENDING_APPROVAL");
  const nothingPending = pendingLeaves.length === 0 && pendingSwaps.length === 0;

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 p-4 pb-24 lg:pb-6">
      <div>
        <h1 className="text-xl font-semibold">My Requests</h1>
        <p className="text-sm text-muted-foreground">
          Your leave and duty swaps. Request leave, or swap with someone on your own shift, from the{" "}
          <Link href="/roster" className="underline underline-offset-2">
            Roster
          </Link>
          .
        </p>
      </div>

      <section className="space-y-3 rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Leave taken</h2>
          <div className="flex rounded-lg border p-0.5 text-xs" role="tablist" aria-label="Leave taken period">
            {(["month", "year"] as const).map((p) => (
              <Link
                key={p}
                href={`/requests?period=${p}`}
                role="tab"
                aria-selected={period === p}
                className={cn("rounded-md px-2.5 py-1", period === p ? "bg-secondary font-semibold" : "text-muted-foreground")}
              >
                {p === "month" ? "This month" : "This year"}
              </Link>
            ))}
          </div>
        </div>
        {byType.length === 0 ? (
          <p className="text-sm text-muted-foreground">No approved leave {period === "year" ? `in ${year}` : "this month"} yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {byType.map((t) => (
              <li key={t.code} className="rounded-md bg-muted px-2.5 py-1 text-xs">
                <span className="font-semibold">{t.code}</span> <span className="tabular-nums">{formatFigure(t.count)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          {formatFigure(total)} day{total === 1 ? "" : "s"} total, {period === "year" ? `in ${year}` : "this month"}.
        </p>
      </section>

      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="text-sm font-semibold">Pending</h2>
        {nothingPending ? (
          <p className="text-sm text-muted-foreground">Nothing pending.</p>
        ) : (
          <div className="space-y-4">
            {pendingLeaves.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground">Leave requests</h3>
                <MyRequests leaves={pendingLeaves} viewer={viewer} />
              </div>
            )}
            {pendingSwaps.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground">Duty swaps</h3>
                <SwapList swaps={pendingSwaps} viewerId={viewer.id} empty="" />
              </div>
            )}
          </div>
        )}
      </section>

      {/* Beyond the two sections above: picking cells on the Roster only covers a swap within your own
          shift (it only shows one shift at a time), so this dropdown form is kept for a partner on
          another shift. */}
      <section className="space-y-3 rounded-xl border border-dashed p-4">
        <div>
          <h2 className="text-sm font-semibold">Request a swap with another shift</h2>
          <p className="text-xs text-muted-foreground">For your own shift, it&apos;s quicker to pick cells on the Roster (Request swap tab).</p>
        </div>
        <SwapForm mode="request" viewerId={viewer.id} firstPeople={[]} partners={partners} today={today} />
      </section>
    </main>
  );
}
