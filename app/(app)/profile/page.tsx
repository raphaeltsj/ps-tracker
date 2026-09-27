import { logout } from "@/app/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { requireViewer } from "@/lib/auth";
import { cyclePositionLabel } from "@/lib/cycle";
import { formatDate, todayLocal } from "@/lib/dates";
import { db } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/domain";
import { canManageDayworkers, canManageTasks, canViewTaskReport } from "@/lib/permissions";
import Link from "next/link";

export const metadata = { title: "Profile | PS Tracker" };

export default async function ProfilePage() {
  const viewer = await requireViewer();
  const staff = await db.staff.findUniqueOrThrow({ where: { id: viewer.id }, include: { shift: true } });
  const today = todayLocal();

  return (
    <main className="mx-auto w-full max-w-md space-y-4 p-4">
      <h1 className="text-xl font-semibold">{staff.name}</h1>
      <dl className="grid grid-cols-[8rem_1fr] gap-y-2 rounded-xl border p-4 text-sm">
        <dt className="text-muted-foreground">Role</dt>
        <dd>{ROLE_LABEL[viewer.role]}</dd>
        <dt className="text-muted-foreground">Shift</dt>
        <dd>{staff.shift?.name ?? "All shifts"}</dd>
        {staff.shift && (
          <>
            <dt className="text-muted-foreground">Cycle today</dt>
            <dd>{cyclePositionLabel(staff.shift.cycleAnchor, today)}</dd>
          </>
        )}
        {staff.birthday && (
          <>
            <dt className="text-muted-foreground">Birthday</dt>
            <dd>{formatDate(`${today.slice(0, 4)}${staff.birthday.slice(4)}`).replace(/^\w+ /, "").replace(/ \d{4}$/, "")}</dd>
          </>
        )}
      </dl>
      {canViewTaskReport(viewer) && (
        <Link href="/task-report" className="flex items-center justify-between rounded-xl border p-4 text-sm hover:bg-accent/40">
          <span>Task report</span>
          <span className="text-muted-foreground">Tasks done by year, month or range</span>
        </Link>
      )}
      {canManageDayworkers(viewer) && (
        <Link href="/dayworkers" className="flex items-center justify-between rounded-xl border p-4 text-sm hover:bg-accent/40">
          <span>Dayworkers</span>
          <span className="text-muted-foreground">Add, and Ops duty counts</span>
        </Link>
      )}
      {canManageTasks(viewer) && (
        <Link href="/tasks" className="flex items-center justify-between rounded-xl border p-4 text-sm hover:bg-accent/40">
          <span>Manage Tasks</span>
          <span className="text-muted-foreground">Add, rename, delete</span>
        </Link>
      )}
      <div className="flex items-center justify-between rounded-xl border p-4 text-sm">
        <span>Light / dark mode</span>
        <ThemeToggle />
      </div>
      <form action={logout}>
        <Button type="submit" variant="outline" className="w-full">
          Sign out
        </Button>
      </form>
    </main>
  );
}
