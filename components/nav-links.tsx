"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import type { NavItem } from "@/components/nav-items";
import { cn } from "@/lib/utils";

const ITEM = "rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent";

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const active = (href: string) => pathname.startsWith(href);

  return items.map((item) => {
    if (!("items" in item)) {
      return (
        <Link key={item.href} href={item.href} className={cn(ITEM, active(item.href) ? "bg-accent font-medium" : "text-muted-foreground")}>
          {item.label}
        </Link>
      );
    }
    const groupActive = item.items.some((l) => active(l.href));
    return (
      <DropdownMenu.Root key={item.label} modal={false}>
        <DropdownMenu.Trigger className={cn(ITEM, "flex items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent", groupActive ? "bg-accent font-medium" : "text-muted-foreground")}>
          {item.label}
          <ChevronDown className="size-3.5 opacity-70" aria-hidden />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={6}
            className="z-50 min-w-44 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          >
            {item.items.map((l) => (
              <DropdownMenu.Item key={l.href} asChild>
                <Link
                  href={l.href}
                  className={cn("block cursor-pointer rounded-md px-3 py-1.5 text-sm outline-none data-[highlighted]:bg-accent", active(l.href) ? "font-medium text-foreground" : "text-muted-foreground")}
                >
                  {l.label}
                </Link>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    );
  });
}
