import Link from "next/link";
import { DutyChip, EventBadge, LeaveChip, LockBadge, TaskTag } from "@/components/roster/chips";
import { StrengthSummary } from "@/components/roster/strength-summary";
import { requireViewer } from "@/lib/auth";
import { cyclePositionLabel } from "@/lib/cycle";
import { addDays, formatDate, formatDateShort, todayLocal } from "@/lib/dates";
import { DUTY_TIMES } from "@/lib/domain";
import { buildRoster } from "@/lib/roster-data";

export const metadata = { title: "Home | PS Tracker" };

export default async function HomePage() {
  const viewer = await requireViewer();
  const today = todayLocal();

  if (!viewer.shiftId) {
    // Management: today across all shifts.
    const rosters = await Promise.all(["A", "B", "C"].map((id) => buildRoster(id, today, today, viewer)));
    return (
      <main className="mx-auto w-full max-w-4xl space-y-4 p-4">
        <h1 className="text-xl font-semibold">Today, {formatDate(today)}</h1>
        <div className="grid gap-3 md:grid-cols-3">
          {rosters.map((r) => {
            const day = r.days[today];
            return (
              <Link key={r.shiftId} href={`/roster?shift=${r.shiftId}`} className="space-y-2 rounded-xl border p-4 hover:bg-accent/40">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{r.shiftName}</span>
                  <span className="text-sm text-muted-foreground">{day.shiftDuty === "OFF" ? "Rest day" : `${day.shiftDuty} duty`}</span>
                </div>
                {day.event && <EventBadge time={day.event.reportTime} />}
                {day.locked && <LockBadge />}
                <StrengthSummary day={day} />
              </Link>
            );
          })}
        </div>
      </main>
    );
  }

  const roster = await buildRoster(viewer.shiftId, today, addDays(today, 6), viewer);
  const me = roster.cells[viewer.id];
  const todayCell = me[today];
  const todayInfo = roster.days[today];

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <section className="space-y-2 rounded-xl border p-4">
        <p className="text-sm text-muted-foreground">{formatDate(today)}</p>
        <div className="flex flex-wrap items-center gap-2">
          <DutyChip duty={todayCell.duty} long className="h-7 px-2.5 text-sm" />
          {DUTY_TIMES[todayCell.duty] && <span className="text-sm">{DUTY_TIMES[todayCell.duty]}</span>}
          {todayCell.task && <TaskTag name={todayCell.task.name} />}
          {todayCell.absences.map((a, i) => <LeaveChip key={i} absence={a} />)}
        </div>
        <p className="text-sm font-medium">{cyclePositionLabel(roster.anchor, today)}</p>
        {todayInfo.event && <EventBadge time={todayInfo.event.reportTime} />}
        {todayInfo.locked && <LockBadge />}
      </section>

      <section className="space-y-2 rounded-xl border p-4">
        <h2 className="text-sm font-semibold">Next 7 days</h2>
        <ul className="divide-y">
          {roster.dates.map((d) => (
            <li key={d} className="flex items-center gap-2 py-1.5 text-sm">
              <span className="w-24 text-muted-foreground">{formatDateShort(d)}</span>
              <DutyChip duty={me[d].duty} long />
              {me[d].task && <TaskTag name={me[d].task.name} />}
              {me[d].absences.map((a, i) => <LeaveChip key={i} absence={a} />)}
              {roster.days[d].event && <span className="text-xs text-fuchsia-700 dark:text-fuchsia-300">Report {roster.days[d].event!.reportTime}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2 rounded-xl border p-4">
        <h2 className="text-sm font-semibold">{roster.shiftName} today</h2>
        <StrengthSummary day={todayInfo} />
      </section>

      <section className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Leave taken this month: coming in a later release.
      </section>
    </main>
  );
}
