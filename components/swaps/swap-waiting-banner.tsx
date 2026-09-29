import Link from "next/link";
import { ArrowLeftRight, ChevronRight } from "lucide-react";

/** Tells the viewer that duty swaps are waiting for their answer or approval, with a way in. */
export function SwapWaitingBanner({ count, href }: { count: number; href: string }) {
  if (count === 0) return null;
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-xl border border-warning/60 bg-warning-soft p-3 text-sm font-medium text-warning-ink hover:bg-warning/20"
    >
      <ArrowLeftRight className="size-4 shrink-0" aria-hidden />
      <span className="flex-1">
        {count} duty swap{count > 1 ? "s" : ""} waiting for you
      </span>
      <span className="flex items-center text-xs underline underline-offset-2">
        Open <ChevronRight className="size-3.5" aria-hidden />
      </span>
    </Link>
  );
}
