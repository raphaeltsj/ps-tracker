import { ArrowLeftRight, CalendarClock, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DOS_LABEL, DOS_REPORT_TIME, DUTY_LABEL, DUTY_TIMES, LEAVE_GROUP_LABEL, leaveGroup, STATUS_LABEL, type DosKind, type Duty, type LeaveGroup, type LeaveStatus } from "@/lib/domain";
import type { CellAbsence, CellSwap, ExtraEntry, OpsEntry } from "@/lib/roster-types";
import { formatFigure, slotLabel, type Strength } from "@/lib/strength";

// Colours always come with a text label (spec 14.2). Palette tokens live in app/globals.css.
const DUTY_STYLE: Record<Duty, string> = {
  AM: "bg-am text-am-ink border-am-edge",
  PM: "bg-pm text-pm-ink border-pm-edge",
  V: "bg-night-strong text-night-ink border-night-strong",
  // Standby only, not on duty: a neutral dashed outline rather than V's indigo.
  VSB: "bg-standby text-standby-ink border-standby-edge border-dashed",
  OFF: "bg-off text-off-ink border-off-edge",
  OFF_V: "bg-offv text-offv-ink border-offv-ink/50 border-dashed",
};

const DUTY_SHORT: Record<Duty, string> = { ...DUTY_LABEL };

/**
 * Roster view cell colours. AM, PM and Off are shown by colour only (no text); V and V(SB) keep
 * their text chip. The legend and cell tooltips / screen-reader labels carry the names.
 */
export const DUTY_CELL: Record<Duty, string> = {
  AM: "bg-am",
  PM: "bg-pm",
  V: "bg-night",
  VSB: "bg-standby",
  OFF: "bg-off",
  // A light tint plus the "Off(V)" text chip (LABELLED_DUTIES below); no border overlay needed.
  OFF_V: "bg-offv",
};

/**
 * A duty assigned over leave (spec 5.1): amber (`warning`, the reserved "pending" colour), pending until the person swaps it away or the duty
 * or leave is removed. Always paired with the "Pending" tag below.
 */
export const DUTY_ON_LEAVE_CELL = "bg-warning-soft outline-2 outline-dashed -outline-offset-2 outline-warning";
export const DUTY_ON_LEAVE_TITLE = "Duty assigned on a leave day: pending until it is swapped away, or the duty or leave is removed";

export function PendingTag({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center rounded border border-warning bg-warning-soft px-1 text-[10px] font-semibold leading-4 text-warning-ink", className)}
      title={DUTY_ON_LEAVE_TITLE}
    >
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
        <span className="grid h-3.5 w-5 place-items-center rounded-sm border border-primary bg-primary text-[7px] font-bold text-primary-foreground" aria-hidden>
          DOS
        </span>
        {DOS_LABEL}
      </li>
      <li className="flex items-center gap-1.5">
        <span className="grid h-3.5 w-5 place-items-center rounded-sm border border-swap bg-swap-soft text-swap-ink" aria-hidden>
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
        <span className="size-2 rounded-full bg-event" aria-hidden />
        Special event
      </li>
      {LEGEND_LEAVE_GROUPS.map((g) => (
        <li key={g} className="flex items-center gap-1.5">
          <span data-leave={g} className="h-3.5 w-5 rounded-sm bg-(--chip)" aria-hidden />
          {LEAVE_GROUP_LABEL[g]}
        </li>
      ))}
    </ul>
  );
}

const LEGEND_LEAVE_GROUPS: LeaveGroup[] = ["annual", "health", "growth", "inlieu"];

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
  const group = leaveGroup(absence.code);
  return (
    <span
      title={`${title} (${LEAVE_GROUP_LABEL[group]})`}
      data-leave={group}
      className={cn(
        // The thin page-coloured ring separates the chip from whatever duty colour it sits on.
        "inline-flex h-5 items-center justify-center rounded border px-1 text-[10px] font-semibold leading-none whitespace-nowrap ring-1 ring-background/70",
        pending || marker
          ? "border-dashed border-(--chip) bg-(--chip-soft) text-(--chip-ink)"
          : half
            ? "leave-half border-(--chip) text-(--chip-ink)"
            : "border-(--chip) bg-(--chip) text-leave-on",
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
        // Solid ink: an official duty, so it reads apart from every leave colour and on every duty colour.
        "inline-flex h-4 items-center rounded-sm border border-primary bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground whitespace-nowrap",
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
            "inline-flex max-w-full cursor-default items-center truncate rounded border border-info/70 bg-info-soft px-0.5 text-[9px] font-bold leading-4 tracking-tight text-info-ink",
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
            "inline-flex max-w-full cursor-default items-center truncate rounded border border-extra/70 bg-extra-soft px-0.5 text-[9px] font-bold leading-4 tracking-tight text-extra-ink",
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
        "inline-flex h-4 max-w-full items-center gap-0.5 truncate rounded-sm border border-swap bg-swap-soft px-0.5 text-[10px] font-bold leading-none tracking-tight text-swap-ink",
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
    <span className={cn("inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[11px] font-semibold text-secondary-foreground ring-1 ring-border", className)}>
      <Lock className="size-3" aria-hidden /> Locked date
    </span>
  );
}

export function EventBadge({ note, className }: { note?: string | null; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded bg-event-soft px-1.5 py-0.5 text-[11px] font-semibold text-event-ink", className)}>
      <CalendarClock className="size-3" aria-hidden /> Special Event{note ? `: ${note}` : ""}
    </span>
  );
}

// Green above 2 slots, yellow at 1-2, red at none or below MFL (spec 8).
export const SLOT_STYLE: Record<Strength["status"], string> = {
  healthy: "text-success-ink",
  low: "text-warning-ink font-semibold",
  zero: "text-danger-ink font-bold",
  below: "text-danger-ink font-bold",
};

export const SLOT_BG: Record<Strength["status"], string> = {
  healthy: "bg-success-soft",
  low: "bg-warning-soft",
  zero: "bg-danger-soft",
  below: "bg-danger/25",
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
    PENDING: "bg-warning-soft text-warning-ink",
    APPROVED: "bg-success-soft text-success-ink",
    REJECTED: "bg-danger-soft text-danger-ink",
    WITHDRAWN: "bg-muted text-muted-foreground",
    CANCELLED: "bg-muted text-muted-foreground",
  };
  return <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold", style[status])}>{STATUS_LABEL[status]}</span>;
}

export { slotLabel };
