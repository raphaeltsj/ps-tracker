import { CalendarRange } from "lucide-react";

/** Neutral placeholder logo until branding is decided. */
export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
        <CalendarRange className="size-4" aria-hidden />
      </span>
      PS Tracker
    </span>
  );
}
