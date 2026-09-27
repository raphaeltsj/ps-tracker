import "server-only";
import { db } from "@/lib/db";

export type NotificationSummary = {
  id: string;
  message: string;
  href: string;
  read: boolean;
  createdAt: string;
};

const RECENT_LIMIT = 20;

/** Most recent notifications for the bell, newest first. */
export async function getNotifications(staffId: string): Promise<NotificationSummary[]> {
  const rows = await db.notification.findMany({
    where: { staffId },
    orderBy: { createdAt: "desc" },
    take: RECENT_LIMIT,
  });
  return rows.map((n) => ({ id: n.id, message: n.message, href: n.href, read: n.read, createdAt: n.createdAt.toISOString() }));
}

export async function getUnreadNotificationCount(staffId: string): Promise<number> {
  return db.notification.count({ where: { staffId, read: false } });
}

/** A leave request was approved or rejected: tell the staff member, unless they decided it themselves. */
export async function notifyLeaveDecision(staffId: string, decidedById: string, typeCode: string, dateList: string, approved: boolean, reason?: string): Promise<void> {
  if (staffId === decidedById) return;
  const message = approved ? `Your ${typeCode} leave on ${dateList} was approved.` : `Your ${typeCode} leave on ${dateList} was rejected${reason ? `: ${reason}` : "."}`;
  await db.notification.create({ data: { staffId, message, href: "/requests" } });
}

export async function markNotificationRead(id: string, staffId: string): Promise<void> {
  await db.notification.updateMany({ where: { id, staffId }, data: { read: true } });
}

export async function markAllNotificationsRead(staffId: string): Promise<void> {
  await db.notification.updateMany({ where: { staffId, read: false }, data: { read: true } });
}
