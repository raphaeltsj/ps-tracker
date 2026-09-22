import { CalendarClock, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { DUTY_LABEL, DUTY_TIMES, STATUS_LABEL, type Duty, type LeaveStatus } from "@/lib/domain";
import type { CellAbsence } from "@/lib/roster-types";
import { formatFigure, slotLabel, type Strength } from "@/lib/strength";

// Colours always come with a text label (spec 14.2).
const DUTY_STYLE: Record<Duty, string> = {
  AM: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-400/15 dark:text-amber-200 dark:border-amber-400/40",
  PM: "bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-400/20 dark:text-indigo-200 dark:border-indigo-400/40",
  V: "bg-violet-900 text-violet-50 border-violet-900 dark:bg-violet-500/40 dark:text-violet-50 dark:border-violet-400/60",
  VSB: "bg-transparent text-violet-800 border-violet-500 border-dashed dark:text-violet-200 dark:border-violet-400",
  OFF: "bg-neutral-100 text-neutral-500 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700",
  OFF_POSTV: "bg-neutral-100 text-violet-700 border-violet-300 border-dashed dark:bg-neutral-800 dark:text-violet-300 dark:border-violet-500/50",
};

const DUTY_SHORT: Record<Duty, string> = { ...DUTY_LABEL, OFF_POSTV: "Off*" };

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
            : "border-teal-600 bg-teal-600 text-white dark:bg-teal-500 dark:border-teal-500 dark:text-teal-950",
        className,
      )}
    >
      {absence.code}
      {pending && "?"}
    </span>
  );
}

export function TaskTag({ name, className }: { name: string; className?: string }) {
  return (
    <span
      title={`Task: ${name}`}
      className={cn(
        "inline-flex h-4 items-center rounded-sm bg-foreground/8 px-1 text-[10px] font-medium leading-none text-foreground/80 whitespace-nowrap",
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

export function EventBadge({ time, className }: { time: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded bg-fuchsia-100 px-1.5 py-0.5 text-[11px] font-semibold text-fuchsia-900 dark:bg-fuchsia-500/20 dark:text-fuchsia-200", className)}>
      <CalendarClock className="size-3" aria-hidden /> Special Event: report at {time}
    </span>
  );
}

export const SLOT_STYLE: Record<Strength["status"], string> = {
  healthy: "text-emerald-700 dark:text-emerald-300",
  low: "text-amber-700 dark:text-amber-300 font-semibold",
  zero: "text-orange-700 dark:text-orange-300 font-semibold",
  below: "text-red-700 dark:text-red-300 font-bold",
};

export const SLOT_BG: Record<Strength["status"], string> = {
  healthy: "bg-emerald-50 dark:bg-emerald-500/10",
  low: "bg-amber-50 dark:bg-amber-500/10",
  zero: "bg-orange-100 dark:bg-orange-500/15",
  below: "bg-red-100 dark:bg-red-500/20",
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
