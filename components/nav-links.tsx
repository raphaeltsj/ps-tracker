"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return links.map((l) => (
    <Link
      key={l.href}
      href={l.href}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent",
        pathname.startsWith(l.href) ? "bg-accent font-medium" : "text-muted-foreground",
      )}
    >
      {l.label}
    </Link>
  ));
}
