import { notFound } from "next/navigation";
import { DayworkerFilters } from "@/components/dayworkers/dayworker-filters";
import { DayworkerManager } from "@/components/dayworkers/dayworker-manager";
import { requireViewer } from "@/lib/auth";
import { dayworkerReportYears, getDayworkerReport } from "@/lib/dayworker-report";
import { formatDate, todayLocal } from "@/lib/dates";
import { canManageDayworkers } from "@/lib/permissions";
import { resolveReportPeriod } from "@/lib/report-period";

export const metadata = { title: "Dayworkers | PS Tracker" };

export default async function DayworkersPage({ searchParams }: PageProps<"/dayworkers">) {
  const viewer = await requireViewer();
  if (!canManageDayworkers(viewer)) notFound();

  const params = await searchParams;
  const param = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const today = todayLocal();
  const { period, year, month, from, to, rangeError, includeScheduled, countTo } = resolveReportPeriod(param, today);

  const [rows, years] = await Promise.all([getDayworkerReport(from, countTo), dayworkerReportYears(Number(today.slice(0, 4)))]);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 p-4 pb-24 lg:pb-6">
      <div>
        <h1 className="text-xl font-semibold">Dayworkers</h1>
        <p className="text-sm text-muted-foreground">
          Office staff who are not part of a shift crew but clock shift duty as Ops duty. Add them here, assign their days from the Ops duty row of the roster, and check how many days each has done.
        </p>
      </div>

      <DayworkerFilters period={period} year={year} month={month} from={from} to={to} includeScheduled={includeScheduled} years={years} />
      {rangeError && <p className="text-sm font-medium text-danger-ink">{rangeError}</p>}

      {countTo < from && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          This period has not started yet, so nothing is counted. Tick &quot;Include scheduled duty&quot; to see what is planned.
        </p>
      )}
      <DayworkerManager rows={rows} countedUntil={formatDate(countTo < from ? from : countTo)} />
    </main>
  );
}
