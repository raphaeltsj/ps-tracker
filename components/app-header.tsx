import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import { logout } from "@/app/actions";
import { Logo } from "@/components/logo";
import { NavLinks } from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL } from "@/lib/domain";
import type { Viewer } from "@/lib/permissions";

export function AppHeader({ viewer, showTasks, badge }: { viewer: Viewer; showTasks: boolean; badge: number }) {
  const links = [
    { href: "/home", label: "Home" },
    { href: "/roster", label: "Roster" },
    ...(viewer.role !== "MANAGEMENT" ? [{ href: "/requests", label: "My requests" }] : []),
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
          {/* Notifications are a future feature: bell with badge as a placeholder (spec 13). */}
          <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications (${badge})`} title="Notifications (coming later)">
            <Bell className="size-4" />
            {badge > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                {badge}
              </span>
            )}
          </Button>
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
