"use client";
import { useState } from "react";
import { Popover } from "radix-ui";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMonth } from "@/lib/dates";
import { cn } from "@/lib/utils";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The month label in the toolbar: click it to jump straight to any month instead of stepping with the arrows. */
export function MonthPicker({ month, today, onPick }: { month: string; today: string; onPick: (month: string) => void }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  const todayMonth = today.slice(0, 7);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        // Reopening always starts on the year being viewed, not wherever the panel was last browsed to.
        if (next) setYear(Number(month.slice(0, 4)));
        setOpen(next);
      }}
    >
      <Popover.Trigger asChild>
        <button
          aria-label={`${formatMonth(month)}, choose month`}
          className="flex min-w-20 items-center justify-center gap-1 rounded-md px-2 py-1 text-sm font-medium hover:bg-accent data-[state=open]:bg-accent"
        >
          {formatMonth(month)}
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="center"
          sideOffset={6}
          className="z-50 w-64 rounded-lg bg-popover p-2 text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          <div className="mb-2 flex items-center justify-between">
            <Button variant="ghost" size="icon" aria-label="Previous year" onClick={() => setYear((y) => y - 1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-semibold" aria-live="polite">
              {year}
            </span>
            <Button variant="ghost" size="icon" aria-label="Next year" onClick={() => setYear((y) => y + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTHS_SHORT.map((label, i) => {
              const value = `${year}-${String(i + 1).padStart(2, "0")}`;
              const selected = value === month;
              return (
                <button
                  key={value}
                  aria-pressed={selected}
                  aria-label={formatMonth(value)}
                  onClick={() => {
                    setOpen(false);
                    if (!selected) onPick(value);
                  }}
                  className={cn(
                    "rounded-md py-1.5 text-sm",
                    selected ? "bg-primary font-medium text-primary-foreground" : "hover:bg-accent",
                    value === todayMonth && !selected && "ring-1 ring-primary",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
