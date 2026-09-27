"use server";
import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/auth";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications";

export async function readNotification(id: string): Promise<void> {
  const viewer = await requireViewer();
  await markNotificationRead(id, viewer.id);
  revalidatePath("/", "layout");
}

export async function readAllNotifications(): Promise<void> {
  const viewer = await requireViewer();
  await markAllNotificationsRead(viewer.id);
  revalidatePath("/", "layout");
}
