"use server";
import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/auth";
import { dismissAnnouncements } from "@/lib/announcements";

/** Closes the banner for this viewer only: the other supervisors' or shifts' copies are unaffected. */
export async function closeAnnouncements(ids: string[]): Promise<void> {
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) return;
  const viewer = await requireViewer();
  await dismissAnnouncements(ids, viewer.id);
  revalidatePath("/", "layout");
}
