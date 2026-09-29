import { ArrowLeftRight, CalendarClock, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DOS_LABEL, DOS_REPORT_TIME, DUTY_LABEL, DUTY_TIMES, STATUS_LABEL, type DosKind, type Duty, type LeaveStatus } from "@/lib/domain";
import type { CellAbsence, CellSwap, ExtraEntry, OpsEntry } from "@/lib/roster-types";
import { formatFigure, slotLabel, type Strength } from "@/lib/strength";

// Colours always come with a text label (spec 14.2).
const DUTY_STYLE: Record<Duty, string> = {
  AM: "bg-yellow-200 text-yellow-900 border-yellow-400 dark:bg-yellow-400 dark:text-yellow-950 dark:border-yellow-400",
  PM: "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-400/20 dark:text-blue-200 dark:border-blue-400/40",
  V: "bg-purple-900 text-purple-50 border-purple-900 dark:bg-purple-500/40 dark:text-purple-50 dark:border-purple-400/60",
  // Standby only, not on duty: a neutral dashed outline rather than V's purple.
  VSB: "bg-transparent text-slate-700 border-slate-400 border-dashed dark:text-slate-300 dark:border-slate-500",
  OFF: "bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700",
  OFF_V: "bg-neutral-100 text-violet-700 border-violet-400 border-dashed dark:bg-neutral-800 dark:text-violet-300 dark:border-violet-500/60",
};

const DUTY_SHORT: Record<Duty, string> = { ...DUTY_LABEL };

/**
 * Roster view cell colours. AM, PM and Off are shown by colour only (no text); V and V(SB) keep
 * their text chip. The legend and cell tooltips / screen-reader labels carry the names.
 */
export const DUTY_CELL: Record<Duty, string> = {
  // Solid in dark mode too: a translucent yellow over the dark background reads as olive/brown.
  AM: "bg-yellow-300 dark:bg-yellow-400",
  PM: "bg-blue-200/80 dark:bg-blue-500/35",
  V: "bg-purple-300/70 dark:bg-purple-600/40",
  VSB: "bg-slate-100 dark:bg-slate-500/15",
  OFF: "bg-neutral-100 dark:bg-neutral-800/70",
  // A light tint plus the "Off(V)" text chip (LABELLED_DUTIES below); no border overlay needed.
  OFF_V: "bg-violet-50 dark:bg-violet-500/10",
};

/**
 * A duty assigned over leave (spec 5.1): orange, pending until the person swaps it away or the duty
 * or leave is removed. Always paired with the "Pending" tag below.
 */
export const DUTY_ON_LEAVE_CELL = "bg-orange-100 outline-2 outline-dashed -outline-offset-2 outline-orange-500 dark:bg-orange-500/20";
export const DUTY_ON_LEAVE_TITLE = "Duty assigned on a leave day: pending until it is swapped away, or the duty or leave is removed";

export function PendingTag() {
  return (
    <span className="rounded border border-orange-500 bg-orange-50 px-1 text-[10px] font-semibold leading-4 text-orange-800 dark:bg-orange-950 dark:text-orange-200" title={DUTY_ON_LEAVE_TITLE}>
      Pending
    </span>
  );
}

/** Duties that keep a text label on the roster. */
export const LABELLED_DUTIES: Duty[] = ["V", "VSB", "OFF_V"];

export function dutyTitle(duty: Duty): string {
  return DUTY_TIMES[duty] ? `${DUTY_LABEL[duty]} ${DUTY_TIMES[duty]}` : DUTY_LABEL[duty];
}

/** Colour legend for the Roster view (spec 14.2). */
export function DutyLegend({ className }: { className?: string }) {
  const items: [Duty, string][] = [
    ["AM", "AM"],
    ["PM", "PM"],
    ["OFF", "Off / Rest"],
    ["OFF_V", "Off(V)"],
    ["V", "V"],
    ["VSB", "V(SB) standby"],
  ];
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground", className)} aria-label="Duty colour legend">
      {items.map(([duty, label]) => (
        <li key={duty} className="flex items-center gap-1.5">
          <span className={cn("grid h-3.5 w-5 place-items-center rounded-sm border border-foreground/10 text-[8px] font-bold text-foreground", DUTY_CELL[duty])} aria-hidden>
            {duty === "V" ? "V" : duty === "VSB" ? "SB" : ""}
          </span>
          {label}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="grid h-3.5 w-5 place-items-center rounded-sm border border-rose-500 bg-rose-500/15 text-[7px] font-bold text-rose-800 dark:text-rose-200" aria-hidden>
          DOS
        </span>
        {DOS_LABEL}
      </li>
      <li className="flex items-center gap-1.5">
        <span className="grid h-3.5 w-5 place-items-center rounded-sm border border-emerald-600 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200" aria-hidden>
          <ArrowLeftRight className="size-2.5" />
        </span>
        Duty swap
      </li>
      <li className="flex items-center gap-1.5" title={DUTY_ON_LEAVE_TITLE}>
        <span className={cn("h-3.5 w-5 rounded-sm", DUTY_ON_LEAVE_CELL)} aria-hidden />
        Duty on leave (pending)
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-3.5 w-5 rounded-sm border bg-hatch" aria-hidden />
        Locked date
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-fuchsia-500" aria-hidden />
        Special event
      </li>
    </ul>
  );
}

export function DutyChip({ duty, className, long }: { duty: Duty; className?: string; long?: boolean }) {
  const title = DUTY_TIMES[duty] ? `${DUTY_LABEL[duty]} ${DUTY_TIMES[duty]}` : DUTY_LABEL[duty];
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-5 items-center justify-center rounded border px-1.5 text-[11px] font-semibold leading-none whitespace-nowrap",
        DUTY_STYLE[duty],
        className,
      )}
    >
      {long ? DUTY_LABEL[duty] : DUTY_SHORT[duty]}
    </span>
  );
}

export function LeaveChip({ absence, className }: { absence: Pick<CellAbsence, "code" | "half" | "status" | "counts" | "derived">; className?: string }) {
  const pending = absence.status === "PENDING";
  const half = absence.half !== null;
  const marker = !pending && absence.counts === 0; // BD on an Off day
  const title = [
    absence.code,
    half ? (absence.half === "FIRST" ? "first half" : "second half") : null,
    pending ? "pending" : marker ? "birthday marker" : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-5 items-center justify-center rounded border px-1 text-[10px] font-semibold leading-none whitespace-nowrap",
        pending || marker
          ? "border-dashed border-teal-500 text-teal-800 dark:text-teal-200"
          : half
            ? "border-teal-600 text-teal-900 dark:text-teal-50 bg-[linear-gradient(135deg,var(--color-teal-300)_50%,transparent_50%)] dark:bg-[linear-gradient(135deg,var(--color-teal-700)_50%,transparent_50%)]"
            : "border-teal-700 bg-teal-700 text-white dark:bg-teal-500 dark:border-teal-500 dark:text-teal-950",
        className,
      )}
    >
      {absence.code}
      {pending && "?"}
    </span>
  );
}

/** DOS / DOS2IC / FDO: a 24-hour duty on top of the shift duty (spec 5.2). */
export function DosTag({ kind, className }: { kind: DosKind; className?: string }) {
  return (
    <span
      title={`${kind}: 24-hour duty, report at ${DOS_REPORT_TIME}. The shift duty and any Task still apply.`}
      className={cn(
        "inline-flex h-4 items-center rounded-sm border border-rose-500 bg-rose-500/15 px-1 text-[10px] font-bold leading-none text-rose-800 whitespace-nowrap dark:bg-rose-950/90 dark:text-rose-200",
        className,
      )}
    >
      {kind}
    </span>
  );
}

/**
 * A dayworker clocking shift duty (spec 5.3). The roster shows the short username; hovering shows the
 * full name, for every user. Sized so a 7-character username fits a roster column.
 */
export function OpsChip({ entry, className }: { entry: OpsEntry; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex max-w-full cursor-default items-center truncate rounded border border-sky-500/70 bg-sky-500/10 px-0.5 text-[9px] font-bold leading-4 tracking-tight text-sky-900 dark:text-sky-100",
            !entry.active && "border-dashed bg-transparent",
            className,
          )}
        >
          {entry.username}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {entry.name} ({entry.username}), dayworker{entry.active ? "" : ", no longer active"}
      </TooltipContent>
    </Tooltip>
  );
}

/** Someone from another shift serving extra duty (spec 5.4): name plus the shift they come from. */
export function ExtraChip({ entry, className }: { entry: ExtraEntry; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex max-w-full cursor-default items-center truncate rounded border border-orange-500/70 bg-orange-500/10 px-0.5 text-[9px] font-bold leading-4 tracking-tight text-orange-900 dark:text-orange-100",
            className,
          )}
        >
          {entry.name}
          <span className="opacity-60">·{entry.fromShiftId}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {entry.name}, from Shift {entry.fromShiftId}, serving extra duty
      </TooltipContent>
    </Tooltip>
  );
}

/** Explains a swapped cell: who the person swapped with and what they would have worked. */
export function swapTitle(swap: CellSwap, duty: Duty): string {
  if (swap.linked) {
    return `Follows the V swap with ${swap.partnerName} (Shift ${swap.partnerShiftId}): ${dutyTitle(duty)} instead of ${DUTY_LABEL[swap.ownDuty]} (the Off(V) moves with the V)`;
  }
  return `Duty swap with ${swap.partnerName} (Shift ${swap.partnerShiftId}): working ${dutyTitle(duty)} instead of ${DUTY_LABEL[swap.ownDuty]}`;
}

/**
 * Approved duty swap (spec 11.4): the cell colour is the duty actually worked, and this tag names the
 * swap partner. Sized to fit a roster column.
 */
export function SwapTag({ swap, duty, className }: { swap: CellSwap; duty: Duty; className?: string }) {
  return (
    <span
      title={swapTitle(swap, duty)}
      className={cn(
        "inline-flex h-4 max-w-full items-center gap-0.5 truncate rounded-sm border border-emerald-600 bg-emerald-100 px-0.5 text-[10px] font-bold leading-none tracking-tight text-emerald-900 dark:bg-emerald-500/25 dark:text-emerald-50",
        className,
      )}
    >
      <ArrowLeftRight className="size-2.5 shrink-0" aria-hidden />
      <span className="sr-only">Swapped with </span>
      {swap.partnerName}
      <span className="opacity-60">·{swap.partnerShiftId}</span>
    </span>
  );
}

export function TaskTag({ name, className }: { name: string; className?: string }) {
  return (
    <span
      title={`Task: ${name}`}
      className={cn(
        // Mostly opaque, so it stays readable on any duty colour (light text on the dark-mode AM yellow washed out).
        "inline-flex h-4 items-center rounded-sm bg-background/85 px-1 text-[10px] font-medium leading-none text-foreground/80 ring-1 ring-foreground/10 whitespace-nowrap",
        className,
      )}
    >
      {name}
    </span>
  );
}

export function LockBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded bg-neutral-200 px-1.5 py-0.5 text-[11px] font-semibold text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100", className)}>
      <Lock className="size-3" aria-hidden /> Locked date
    </span>
  );
}

export function EventBadge({ note, className }: { note?: string | null; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded bg-fuchsia-100 px-1.5 py-0.5 text-[11px] font-semibold text-fuchsia-900 dark:bg-fuchsia-500/20 dark:text-fuchsia-200", className)}>
      <CalendarClock className="size-3" aria-hidden /> Special Event{note ? `: ${note}` : ""}
    </span>
  );
}

// Green above 2 slots, yellow at 1-2, red at none or below MFL (spec 8).
export const SLOT_STYLE: Record<Strength["status"], string> = {
  healthy: "text-emerald-700 dark:text-emerald-300",
  low: "text-amber-800 dark:text-amber-300 font-semibold",
  zero: "text-red-700 dark:text-red-300 font-bold",
  below: "text-red-700 dark:text-red-300 font-bold",
};

export const SLOT_BG: Record<Strength["status"], string> = {
  healthy: "bg-emerald-50 dark:bg-emerald-500/10",
  low: "bg-amber-100 dark:bg-amber-500/15",
  zero: "bg-red-100 dark:bg-red-500/20",
  below: "bg-red-200 dark:bg-red-500/30",
};

export function SlotBadge({ strength, className }: { strength: Strength; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-xs tabular-nums", SLOT_STYLE[strength.status], SLOT_BG[strength.status], className)}>
      {strength.status === "zero" ? "No slots" : strength.status === "below" ? `${formatFigure(strength.slots)} below MFL` : `${formatFigure(strength.slots)} slots`}
    </span>
  );
}

export function StatusBadge({ status }: { status: LeaveStatus }) {
  const style: Record<LeaveStatus, string> = {
    PENDING: "bg-amber-100 text-amber-900 dark:bg-amber-400/20 dark:text-amber-200",
    APPROVED: "bg-teal-100 text-teal-900 dark:bg-teal-400/20 dark:text-teal-200",
    REJECTED: "bg-red-100 text-red-900 dark:bg-red-400/20 dark:text-red-200",
    WITHDRAWN: "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200",
    CANCELLED: "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200",
  };
  return <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold", style[status])}>{STATUS_LABEL[status]}</span>;
}

export { slotLabel };
