"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardCheck, Inbox, User } from "lucide-react";
import { cn } from "@/lib/utils";

/** Mobile bottom tabs: Roster, Requests, Manage (supervisors/Management), Profile (spec 14.1). */
export function MobileTabs({ showRequests, showManageRequests }: { showRequests: boolean; showManageRequests: boolean }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/roster", label: "Roster", icon: CalendarDays },
    ...(showRequests ? [{ href: "/requests", label: "Requests", icon: Inbox }] : []),
    ...(showManageRequests ? [{ href: "/manage-requests", label: "Manage", icon: ClipboardCheck }] : []),
    { href: "/profile", label: "Profile", icon: User },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 border-t bg-background lg:hidden">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn("flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px]", active ? "text-foreground font-semibold" : "text-muted-foreground")}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
