import { notFound } from "next/navigation";
import { TaskReportFilters, type Period } from "@/components/tasks/task-report-filters";
import { TaskReportTable } from "@/components/tasks/task-report-table";
import { requireViewer } from "@/lib/auth";
import { dayIndex, formatDate, fromDayIndex, isValidDate, isValidMonth, monthDates, todayLocal } from "@/lib/dates";
import { db } from "@/lib/db";
import { canViewTaskReport } from "@/lib/permissions";
import { getTaskReport, taskReportYears } from "@/lib/task-report";

export const metadata = { title: "Task report | PS Tracker" };

const SHIFTS = ["A", "B", "C"];
const MAX_RANGE_DAYS = 366 * 3;

export default async function TaskReportPage({ searchParams }: PageProps<"/task-report">) {
  const viewer = await requireViewer();
  if (!canViewTaskReport(viewer)) notFound();

  const params = await searchParams;
  const param = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const today = todayLocal();

  // Period: a year, a month, or a date range. Defaults to this month.
  const period: Period = param("period") === "year" || param("period") === "range" ? (param("period") as Period) : "month";
  const year = /^\d{4}$/.test(param("year")) ? param("year") : today.slice(0, 4);
  const month = isValidMonth(param("month")) ? param("month") : today.slice(0, 7);
  let from: string;
  let to: string;
  let rangeError: string | null = null;
  if (period === "year") {
    [from, to] = [`${year}-01-01`, `${year}-12-31`];
  } else if (period === "range") {
    from = isValidDate(param("from")) ? param("from") : `${today.slice(0, 7)}-01`;
    to = isValidDate(param("to")) ? param("to") : today;
    if (from > to) {
      rangeError = "The start date is after the end date.";
      [from, to] = [to, from];
    }
    if (dayIndex(to) - dayIndex(from) > MAX_RANGE_DAYS) {
      rangeError = "Ranges are limited to 3 years, so the end date was shortened.";
      to = fromDayIndex(dayIndex(from) + MAX_RANGE_DAYS);
    }
  } else {
    const days = monthDates(month);
    [from, to] = [days[0], days[days.length - 1]];
  }

  // "Done" means up to today unless the viewer includes scheduled (future) Tasks.
  const includeScheduled = param("scheduled") === "1";
  const countTo = includeScheduled || to < today ? to : today;

  // Supervisors start on their own shift; everyone can look at every shift, like the roster.
  const defaultShift = viewer.role === "SUPERVISOR" && viewer.shiftId ? viewer.shiftId : "all";
  const shift = SHIFTS.includes(param("shift")) || param("shift") === "all" ? param("shift") : defaultShift;
  const hideEmpty = param("hide") === "1";
  // With many Tasks: pick which ones to show, and hide Tasks nobody did in the period by default.
  const showUnused = param("unused") === "1";
  const allTasks = await db.task.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } });
  const picked = param("tasks") ? param("tasks").split(",").filter((id) => allTasks.some((t) => t.id === id)) : [];
  const taskIds = picked.length ? picked : null;

  const [report, years] = await Promise.all([
    getTaskReport(from, countTo, shift === "all" ? SHIFTS : [shift], taskIds),
    taskReportYears(Number(today.slice(0, 4))),
  ]);
  const hiddenUnused = showUnused ? 0 : report.tasks.filter((t) => !report.taskTotals[t.id]).length;
  if (!showUnused) report.tasks = report.tasks.filter((t) => report.taskTotals[t.id]);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4 pb-24 lg:pb-6">
      <div>
        <h1 className="text-xl font-semibold">Task report</h1>
        <p className="text-sm text-muted-foreground">Which Tasks each person has done, and how many days of each.</p>
      </div>

      <TaskReportFilters
        period={period}
        year={year}
        month={month}
        from={from}
        to={to}
        shift={shift}
        includeScheduled={includeScheduled}
        hideEmpty={hideEmpty}
        showUnused={showUnused}
        years={years}
        allTasks={allTasks}
        pickedTasks={picked}
      />

      <p className="text-sm">
        <span className="font-medium">
          {formatDate(from)} to {formatDate(countTo < from ? from : countTo)}
        </span>
        <span className="text-muted-foreground">
          {" "}
          · {shift === "all" ? "All shifts" : `Shift ${shift}`}
          {!includeScheduled && to > today ? " · counted up to today" : ""}
          {picked.length ? ` · ${picked.length} of ${allTasks.length} Tasks selected` : ""}
          {hiddenUnused ? ` · ${hiddenUnused} unused Task${hiddenUnused > 1 ? "s" : ""} hidden` : ""}
        </span>
      </p>
      {rangeError && <p className="text-sm font-medium text-red-700 dark:text-red-300">{rangeError}</p>}
      {countTo < from ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          This period has not started yet. Tick &quot;Include scheduled Tasks&quot; to see what is planned.
        </p>
      ) : (
        <TaskReportTable report={report} hideEmpty={hideEmpty} showShift={shift === "all"} />
      )}
    </main>
  );
}
