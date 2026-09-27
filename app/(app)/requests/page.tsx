import { MyRequests } from "@/components/roster/my-requests";
import { requireViewer } from "@/lib/auth";
import { canDecideLeave, canRequestLeave } from "@/lib/permissions";
import { getMyLeaves } from "@/lib/roster-data";
import { firstDateWithoutSlot } from "@/lib/slots";
import Link from "next/link";
import { SwapWaitingBanner } from "@/components/swaps/swap-waiting-banner";
import { swapsAwaiting } from "@/lib/swap-data";

export const metadata = { title: "My requests | PS Tracker" };

export default async function RequestsPage() {
  const viewer = await requireViewer();
  if (!canRequestLeave(viewer)) {
    return <main className="p-6 text-sm text-muted-foreground">Management does not request leave.</main>;
  }
  const [leaves, swapsWaiting] = await Promise.all([getMyLeaves(viewer.id), swapsAwaiting(viewer)]);
  for (const l of leaves) {
    if (l.status === "PENDING" && canDecideLeave(viewer, l.staffId, l.shiftId)) l.noSlotOn = await firstDateWithoutSlot(l);
  }
  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <SwapWaitingBanner count={swapsWaiting} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">My requests</h1>
        <span className="flex gap-4">
          <Link href="/swaps" className="text-sm underline underline-offset-4">
            Duty swaps
          </Link>
          <Link href="/roster" className="text-sm underline underline-offset-4">
            Request leave
          </Link>
        </span>
      </div>
      <MyRequests leaves={leaves} viewer={viewer} />
    </main>
  );
}
