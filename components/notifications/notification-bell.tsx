"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { readAllNotifications, readNotification } from "@/app/notification-actions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { formatDateTime } from "@/lib/dates";
import type { NotificationSummary } from "@/lib/notifications";
import { cn } from "@/lib/utils";

/**
 * The bell: a badge (items needing the viewer's action, plus unread notifications) that opens a
 * panel of personal notifications (so far: leave decisions). Clicking one marks it read and goes
 * to its page; unread ones are highlighted. Below the list, a link covers anything still waiting
 * on the viewer that isn't a notification yet (pending approvals, swap responses).
 */
export function NotificationBell({
  notifications,
  unreadCount,
  badge,
  bellHref,
}: {
  notifications: NotificationSummary[];
  unreadCount: number;
  badge: number;
  bellHref: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const waiting = Math.max(0, badge - unreadCount);

  const openNotification = async (n: NotificationSummary) => {
    setOpen(false);
    if (!n.read) await readNotification(n.id);
    router.push(n.href);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`${badge} waiting for you`} title={badge ? `${badge} waiting for you` : "Nothing waiting"}>
          <Bell className="size-4" />
          {badge > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{badge}</span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-sm">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>Notifications</SheetTitle>
            {unreadCount > 0 && (
              <button type="button" className="text-xs text-muted-foreground underline underline-offset-2" onClick={() => readAllNotifications()}>
                Mark all read
              </button>
            )}
          </div>
        </SheetHeader>
        <div className="flex-1 space-y-1.5 overflow-y-auto px-4 pb-4">
          {notifications.length === 0 && waiting === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => openNotification(n)}
                className={cn("block w-full rounded-lg border p-2.5 text-left text-sm hover:bg-accent", !n.read && "border-primary/40 bg-primary/5")}
              >
                <span className="flex items-start gap-2">
                  {!n.read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />}
                  <span className="flex-1">{n.message}</span>
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</span>
              </button>
            ))
          )}
          {waiting > 0 && (
            <Link href={bellHref} onClick={() => setOpen(false)} className="block rounded-lg border border-dashed p-2.5 text-sm text-muted-foreground hover:bg-accent">
              {waiting} item{waiting === 1 ? "" : "s"} waiting for you →
            </Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
