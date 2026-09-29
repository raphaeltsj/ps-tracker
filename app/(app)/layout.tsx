import { AnnouncementBanner } from "@/components/announcements/announcement-banner";
import { AppHeader } from "@/components/app-header";
import { MobileTabs } from "@/components/mobile-tabs";
import { getActiveAnnouncements } from "@/lib/announcements";
import { requireViewer } from "@/lib/auth";
import { db } from "@/lib/db";
import { getNotifications, getUnreadNotificationCount } from "@/lib/notifications";
import { canEditShift, canManageDayworkers, canManageTasks, canViewLeaveReport, canViewTaskReport, hasEditView } from "@/lib/permissions";
import { swapsAwaiting } from "@/lib/swap-data";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const viewer = await requireViewer();
  // Bell badge: pending requests the viewer could review, or their own pending ones.
  const pending = await db.leave.findMany({ where: { status: "PENDING" }, select: { staffId: true, staff: { select: { shiftId: true } } } });
  // Plus duty swaps waiting for the viewer's answer or approval, plus unread notifications (their
  // own leave decisions).
  const [swapsWaiting, notifications, unreadCount, announcements] = await Promise.all([
    swapsAwaiting(viewer),
    getNotifications(viewer.id),
    getUnreadNotificationCount(viewer.id),
    getActiveAnnouncements(viewer),
  ]);
  const actionNeeded = pending.filter((l) => l.staffId === viewer.id || canEditShift(viewer, l.staff.shiftId)).length + swapsWaiting;
  const badge = actionNeeded + unreadCount;
  const showManageRequests = hasEditView(viewer);
  // The bell's fallback link, for whatever is waiting that isn't a notification yet.
  const bellHref = actionNeeded > 0 ? (showManageRequests ? "/manage-requests" : "/requests") : viewer.role === "MANAGEMENT" ? "/roster?mode=edit" : "/requests";

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Remounts when the active set changes, so a fresh banner reappears after one is closed. */}
      <AnnouncementBanner key={announcements.map((a) => a.id).join(",")} announcements={announcements} />
      <AppHeader
        viewer={viewer}
        showTasks={canManageTasks(viewer)}
        showTaskReport={canViewTaskReport(viewer)}
        showLeaveReport={canViewLeaveReport(viewer)}
        showDayworkers={canManageDayworkers(viewer)}
        showManageRequests={showManageRequests}
        showStaff={hasEditView(viewer)}
        badge={badge}
        bellHref={bellHref}
        notifications={notifications}
        unreadCount={unreadCount}
      />
      <div className="flex min-h-0 flex-1 flex-col pb-16 lg:pb-0">{children}</div>
      <MobileTabs showRequests={viewer.role !== "MANAGEMENT"} showManageRequests={showManageRequests} />
    </div>
  );
}
