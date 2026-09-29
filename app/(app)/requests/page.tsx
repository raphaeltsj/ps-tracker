import Link from "next/link";
import { LeaveTaken } from "@/components/requests/leave-taken";
import { RequestsHistory } from "@/components/requests/requests-history";
import { SwapFeedbackProvider } from "@/components/swaps/swap-list";
import { requireViewer } from "@/lib/auth";
import { monthDates, todayLocal } from "@/lib/dates";
import { db } from "@/lib/db";
import { baseLeaveCode } from "@/lib/domain";
import { leaveTakenRows, tallyLeaveTaken } from "@/lib/leave-report";
import { getOilBalances } from "@/lib/oil";
import { canDecideLeave, canRequestLeave } from "@/lib/permissions";
import { buildRoster, getMyLeaves } from "@/lib/roster-data";
import { firstDateWithoutSlot } from "@/lib/slots";
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

/** Status only: leave taken, and every leave request / duty swap with its status. Request leave or a
 * swap from the Roster (spec 11.1, 11.4). */
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

  const yearFrom = `${year}-01-01`;
  const yearTo = `${year}-12-31`;

  const [leaves, swaps, roster, annualRoster, leaveTypes, oilBalances] = await Promise.all([
    getMyLeaves(viewer.id),
    getSwapsFor(viewer),
    buildRoster(viewer.shiftId!, from, to, viewer),
    // Limits are checked against the year no matter which period is shown above; reuse the year
    // roster instead of a second query when that's already the selected period.
    period === "year" ? Promise.resolve(null) : buildRoster(viewer.shiftId!, yearFrom, yearTo, viewer, { staffIds: [viewer.id] }),
    db.leaveType.findMany({ orderBy: [{ custom: "asc" }, { sortOrder: "asc" }] }),
    getOilBalances([viewer.id]),
  ]);
  for (const l of leaves) {
    if (l.status === "PENDING" && canDecideLeave(viewer, l.staffId, l.shiftId)) l.noSlotOn = await firstDateWithoutSlot(l);
  }
  const { total, byType } = tallyLeaveTaken(roster.cells[viewer.id], roster.dates);
  const { byType: annualByType } = annualRoster ? tallyLeaveTaken(annualRoster.cells[viewer.id], annualRoster.dates) : { byType };
  // Every leave type shows, even at zero, not just the ones actually taken. Half/full-day variants of
  // the same type combine (0.5 AL + AL = AL), and AL/OL, MC, OML, BD/BD-IL and GRW each get a combined
  // annual limit; OIL shows what supervisors have allowed; everything else has no limit.
  const baseCodes = [...new Set(leaveTypes.map((t) => baseLeaveCode(t.code)))];
  const leaveRows = leaveTakenRows(byType, annualByType, baseCodes, oilBalances[viewer.id]);

  // Full history, every status (Pending, Approved, Rejected, Declined/Cancelled/Expired), not only pending.
  const mySwaps = swaps.filter((s) => s.requester.id === viewer.id || s.partner.id === viewer.id);

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
    <SwapFeedbackProvider>
      <main className="mx-auto w-full max-w-6xl space-y-4 p-4 pb-24 lg:pb-6">
        <div>
          <h1 className="text-xl font-semibold">My Requests</h1>
          <p className="text-sm text-muted-foreground">
            Your leave taken, and the status of every leave request and duty swap. Request leave, or a swap, from the{" "}
            <Link href="/roster" className="underline underline-offset-2">
              Roster
            </Link>
            .
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[320px_1fr] lg:items-start">
          <Section title="Leave taken" action={periodTabs}>
            <LeaveTaken rows={leaveRows} total={total} periodLabel={period === "year" ? `in ${year}` : "this month"} />
          </Section>

          <RequestsHistory leaves={leaves} swaps={mySwaps} viewer={viewer} />
        </div>
      </main>
    </SwapFeedbackProvider>
  );
}
