import { AppHeader } from "@/components/app-header";
import { MobileTabs } from "@/components/mobile-tabs";
import { requireViewer } from "@/lib/auth";
import { db } from "@/lib/db";
import { canEditShift, canManageDayworkers, canManageTasks, canViewTaskReport } from "@/lib/permissions";
import { swapsAwaiting } from "@/lib/swap-data";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const viewer = await requireViewer();
  // Bell badge placeholder: pending requests the viewer could review, or their own pending ones.
  const pending = await db.leave.findMany({ where: { status: "PENDING" }, select: { staffId: true, staff: { select: { shiftId: true } } } });
  // Plus duty swaps waiting for the viewer's answer or approval.
  const badge = pending.filter((l) => l.staffId === viewer.id || canEditShift(viewer, l.staff.shiftId)).length + (await swapsAwaiting(viewer));

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader viewer={viewer} showTasks={canManageTasks(viewer)} showTaskReport={canViewTaskReport(viewer)} showDayworkers={canManageDayworkers(viewer)} badge={badge} />
      <div className="flex min-h-0 flex-1 flex-col pb-16 lg:pb-0">{children}</div>
      <MobileTabs showRequests={viewer.role !== "MANAGEMENT"} />
    </div>
  );
}
