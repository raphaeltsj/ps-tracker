import "server-only";
import { db } from "@/lib/db";
import { todayLocal } from "@/lib/dates";
import type { Viewer } from "@/lib/permissions";

export const ANNOUNCEMENT_MESSAGE_MAX = 200;

export type AnnouncementSummary = { id: string; message: string };

/**
 * Active announcements for the viewer: every-shift ones plus their own shift's, from their showFrom
 * date up to the locked/event date they were set for, not yet closed by this viewer. Several combine
 * into one banner (spec 8.4); this just returns the list, in the order they were set.
 */
export async function getActiveAnnouncements(viewer: Viewer): Promise<AnnouncementSummary[]> {
  const today = todayLocal();
  const rows = await db.announcement.findMany({
    where: {
      showFrom: { lte: today },
      activeUntil: { gte: today },
      OR: [{ shiftId: null }, { shiftId: viewer.shiftId }],
      dismissals: { none: { staffId: viewer.id } },
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({ id: r.id, message: r.message }));
}

/** Closing the banner: it stops showing to this viewer only. */
export async function dismissAnnouncements(ids: string[], staffId: string): Promise<void> {
  await Promise.all(
    ids.map((announcementId) =>
      db.announcementDismissal.upsert({
        where: { announcementId_staffId: { announcementId, staffId } },
        create: { announcementId, staffId },
        update: {},
      }),
    ),
  );
}
