import Link from "next/link";
import { LogOut } from "lucide-react";
import { logout } from "@/app/actions";
import { DevClearRoster } from "@/components/dev-clear-roster";
import { Logo } from "@/components/logo";
import { NavLinks } from "@/components/nav-links";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL } from "@/lib/domain";
import type { NotificationSummary } from "@/lib/notifications";
import type { Viewer } from "@/lib/permissions";

export function AppHeader({
  viewer,
  showTasks,
  showTaskReport,
  showDayworkers,
  showManageRequests,
  showStaff,
  badge,
  bellHref,
  notifications,
  unreadCount,
}: {
  viewer: Viewer;
  showTasks: boolean;
  showTaskReport: boolean;
  showDayworkers: boolean;
  showManageRequests: boolean;
  showStaff: boolean;
  badge: number;
  bellHref: string;
  notifications: NotificationSummary[];
  unreadCount: number;
}) {
  const links = [
    { href: "/roster", label: "Roster" },
    ...(viewer.role !== "MANAGEMENT" ? [{ href: "/requests", label: "My Requests" }] : []),
    ...(showManageRequests ? [{ href: "/manage-requests", label: "Manage requests" }] : []),
    ...(showTaskReport ? [{ href: "/task-report", label: "Task report" }] : []),
    ...(showDayworkers ? [{ href: "/dayworkers", label: "Dayworkers" }] : []),
    ...(showStaff ? [{ href: "/staff", label: "Staff" }] : []),
    ...(showTasks ? [{ href: "/tasks", label: "Tasks" }] : []),
  ];
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="flex h-14 items-center gap-4 px-4">
        <Link href="/roster" aria-label="PS Tracker home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex">
          <NavLinks links={links} />
        </nav>
        <div className="ml-auto flex items-center gap-1">
          {/* TEMPORARY developer tool: clears the whole roster. Never shown in production. */}
          {process.env.NODE_ENV !== "production" && viewer.role !== "STAFF" && <DevClearRoster />}
          <NotificationBell notifications={notifications} unreadCount={unreadCount} badge={badge} bellHref={bellHref} />
          <ThemeToggle />
          <Link href="/profile" className="hidden text-right text-xs leading-tight sm:block">
            <span className="block font-medium">{viewer.name}</span>
            <span className="block text-muted-foreground">
              {ROLE_LABEL[viewer.role]}
              {viewer.shiftId ? `, Shift ${viewer.shiftId}` : ""}
            </span>
          </Link>
          <form action={logout}>
            <Button variant="ghost" size="icon" type="submit" aria-label="Sign out" title="Sign out">
              <LogOut className="size-4" />
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
