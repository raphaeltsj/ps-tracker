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

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

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

  const [leaves, swaps, roster, staff, leaveTypes] = await Promise.all([
    getMyLeaves(viewer.id),
    getSwapsFor(viewer),
    buildRoster(viewer.shiftId!, from, to, viewer),
    db.staff.findMany({ where: { active: true, role: { not: "MANAGEMENT" }, shiftId: { not: null } }, orderBy: [{ shiftId: "asc" }, { name: "asc" }] }),
    db.leaveType.findMany({ orderBy: [{ custom: "asc" }, { sortOrder: "asc" }] }),
  ]);
  for (const l of leaves) {
    if (l.status === "PENDING" && canDecideLeave(viewer, l.staffId, l.shiftId)) l.noSlotOn = await firstDateWithoutSlot(l);
  }
  const { total, byType } = tallyLeaveTaken(roster.cells[viewer.id], roster.dates);
  // Every leave type shows, even at zero, not just the ones actually taken.
  const fullByType = leaveTypes.map((t) => ({ code: t.code, count: byType.find((b) => b.code === t.code)?.count ?? 0 }));
  // Duty swaps are only between different shifts.
  const partners = staff.filter((s) => s.id !== viewer.id && s.shiftId !== viewer.shiftId).map((s) => ({ id: s.id, name: s.name, shiftId: s.shiftId! }));

  const pendingLeaves = leaves.filter((l) => l.status === "PENDING");
  const mySwaps = swaps.filter((s) => s.requester.id === viewer.id || s.partner.id === viewer.id);
  const pendingSwaps = mySwaps.filter((s) => s.status === "PENDING_PARTNER" || s.status === "PENDING_APPROVAL");
  const nothingPending = pendingLeaves.length === 0 && pendingSwaps.length === 0;

  const periodTabs = (
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
  );

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4 pb-24 lg:pb-6">
      <div>
        <h1 className="text-xl font-semibold">My Requests</h1>
        <p className="text-sm text-muted-foreground">
          Your leave and duty swaps. Request leave from the{" "}
          <Link href="/roster" className="underline underline-offset-2">
            Roster
          </Link>
          , or request a swap with someone on another shift below.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <Section title="Leave taken" action={periodTabs}>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {fullByType.map((t) => (
                <li key={t.code} className={cn("rounded-lg border p-2.5", t.count === 0 && "opacity-60")}>
                  <div className="truncate text-xs font-medium text-muted-foreground" title={t.code}>
                    {t.code}
                  </div>
                  <div className="text-lg font-semibold tabular-nums">{formatFigure(t.count)}</div>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              {formatFigure(total)} day{total === 1 ? "" : "s"} total, {period === "year" ? `in ${year}` : "this month"}.
            </p>
          </Section>

          <Section title="Pending">
            {nothingPending ? (
              <p className="text-sm text-muted-foreground">Nothing pending.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
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
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Request a swap">
            <p className="text-xs text-muted-foreground">Duty swaps are only between two different shifts.</p>
            <SwapForm mode="request" viewerId={viewer.id} firstPeople={[]} partners={partners} today={today} />
          </Section>
        </div>
      </div>
    </main>
  );
}
