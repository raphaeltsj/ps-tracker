import { SLOT_BG, SLOT_STYLE } from "@/components/roster/chips";
import type { RosterDay } from "@/lib/roster-types";
import { formatFigure } from "@/lib/strength";
import { cn } from "@/lib/utils";

/** Strength figures for one day. Compact shows only Available Slot(s). */
export function StrengthSummary({ day, compact = false }: { day: RosterDay; compact?: boolean }) {
  const s = day.strength;
  const slots = (
    <div className={cn("rounded-md px-2 py-1.5", SLOT_BG[s.status])}>
      <div className="text-[10px] uppercase text-muted-foreground">Available Slot(s)</div>
      <div className={cn("text-lg tabular-nums", SLOT_STYLE[s.status])}>
        {s.status === "zero" ? "No slots" : s.status === "below" ? `⚠ ${formatFigure(s.slots)} (below MFL)` : formatFigure(s.slots)}
      </div>
    </div>
  );
  if (compact) return slots;

  const figures: [string, string][] = [
    ["Total", String(s.total)],
    ["Not in", formatFigure(s.notIn)],
    ["Working", formatFigure(s.working)],
    ["MFL", s.mfl === null ? "Blank (Rest day)" : String(s.mfl)],
  ];
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-4 gap-1.5">
        {figures.map(([label, value]) => (
          <div key={label} className="rounded-md bg-muted px-2 py-1.5">
            <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
            <div className={cn("tabular-nums", value.length > 6 ? "text-[11px] leading-5" : "text-base")}>{value}</div>
          </div>
        ))}
      </div>
      {slots}
      {day.v && (
        <div className={cn("text-xs", day.v.onDuty < day.v.mfl ? "font-semibold text-danger-ink" : "text-muted-foreground")}>
          V on duty: {day.v.onDuty} of {day.v.mfl} needed
        </div>
      )}
    </div>
  );
}
