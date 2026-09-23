"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type Period = "year" | "month" | "range";

type Props = {
  period: Period;
  year: string;
  month: string;
  from: string;
  to: string;
  shift: string;
  includeScheduled: boolean;
  hideEmpty: boolean;
  showUnused: boolean;
  years: number[];
  allTasks: { id: string; name: string }[];
  pickedTasks: string[];
};

/** Filter by year, month or date range, plus shift. State lives in the URL so views can be shared. */
export function TaskReportFilters(props: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [period, setPeriod] = useState<Period>(props.period);
  const [year, setYear] = useState(props.year);
  const [month, setMonth] = useState(props.month);
  const [from, setFrom] = useState(props.from);
  const [to, setTo] = useState(props.to);
  const [shift, setShift] = useState(props.shift);
  const [scheduled, setScheduled] = useState(props.includeScheduled);
  const [hide, setHide] = useState(props.hideEmpty);
  const [unused, setUnused] = useState(props.showUnused);
  // null = all Tasks
  const [picked, setPicked] = useState<string[] | null>(props.pickedTasks.length ? props.pickedTasks : null);

  function apply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.currentTarget.querySelectorAll("details[open]").forEach((d) => d.removeAttribute("open"));
    const q = new URLSearchParams({ period, shift });
    if (period === "year") q.set("year", year);
    if (period === "month") q.set("month", month);
    if (period === "range") {
      q.set("from", from);
      q.set("to", to);
    }
    if (scheduled) q.set("scheduled", "1");
    if (hide) q.set("hide", "1");
    if (unused) q.set("unused", "1");
    // Empty or "everything" means all Tasks.
    if (picked && picked.length < props.allTasks.length) q.set("tasks", picked.join(","));
    router.push(`${pathname}?${q.toString()}`);
  }

  const label = "text-xs font-medium text-muted-foreground";
  return (
    <form onSubmit={apply} className="relative z-40 flex flex-wrap items-end gap-3 rounded-xl border bg-background p-3">
      <div className="space-y-1">
        <span className={label}>Period</span>
        <div className="flex rounded-lg border p-0.5 text-sm" role="radiogroup" aria-label="Period">
          {(
            [
              ["year", "Year"],
              ["month", "Month"],
              ["range", "Date range"],
            ] as const
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={period === value}
              onClick={() => setPeriod(value)}
              className={cn("rounded-md px-3 py-1", period === value ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-accent")}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      {period === "year" && (
        <label className="space-y-1">
          <span className={cn(label, "block")}>Year</span>
          <select value={year} onChange={(e) => setYear(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
            {props.years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      )}
      {period === "month" && (
        <label className="space-y-1">
          <span className={cn(label, "block")}>Month</span>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} required className="w-44" />
        </label>
      )}
      {period === "range" && (
        <>
          <label className="space-y-1">
            <span className={cn(label, "block")}>From</span>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} required className="w-40" />
          </label>
          <label className="space-y-1">
            <span className={cn(label, "block")}>To</span>
            <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} required className="w-40" />
          </label>
        </>
      )}

      <label className="space-y-1">
        <span className={cn(label, "block")}>Shift</span>
        <select value={shift} onChange={(e) => setShift(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="all">All shifts</option>
          {["A", "B", "C"].map((s) => (
            <option key={s} value={s}>
              Shift {s}
            </option>
          ))}
        </select>
      </label>

      <TaskPicker tasks={props.allTasks} picked={picked} onChange={setPicked} />

      <div className="flex flex-col gap-1 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={scheduled} onChange={(e) => setScheduled(e.target.checked)} className="size-4" />
          Include scheduled Tasks (after today)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} className="size-4" />
          Hide staff with no Tasks
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={unused} onChange={(e) => setUnused(e.target.checked)} className="size-4" />
          Show Tasks nobody did
        </label>
      </div>

      <Button type="submit" className="ml-auto" disabled={picked?.length === 0} title={picked?.length === 0 ? "Pick at least one Task" : undefined}>
        Apply
      </Button>
    </form>
  );
}

/** Choose which Tasks to show. Scales to many Tasks with search, select all and clear. */
function TaskPicker({ tasks, picked, onChange }: { tasks: { id: string; name: string }[]; picked: string[] | null; onChange: (ids: string[] | null) => void }) {
  const [query, setQuery] = useState("");
  const shown = tasks.filter((t) => t.name.toLowerCase().includes(query.trim().toLowerCase()));
  const isOn = (id: string) => picked === null || picked.includes(id);
  const toggle = (id: string) => {
    const current = picked ?? tasks.map((t) => t.id);
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    onChange(next.length === tasks.length ? null : next);
  };
  const summary = picked === null ? `All Tasks (${tasks.length})` : picked.length === 0 ? "No Tasks picked" : `${picked.length} of ${tasks.length} Tasks`;

  return (
    <div className="space-y-1">
      <span className="block text-xs font-medium text-muted-foreground">Tasks</span>
      <details className="relative">
        <summary className={cn("flex h-9 cursor-pointer list-none items-center rounded-md border bg-background px-3 text-sm", picked?.length === 0 && "border-red-500 text-red-700 dark:text-red-300")}>
          {summary}
        </summary>
        <div className="absolute z-50 mt-1 max-h-[60vh] w-64 space-y-2 overflow-y-auto rounded-lg border bg-popover p-2 shadow-xl">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Tasks" className="h-8" aria-label="Search Tasks" />
          <div className="flex gap-3 text-xs">
            <button type="button" className="underline underline-offset-2" onClick={() => onChange(null)}>
              Select all
            </button>
            <button type="button" className="underline underline-offset-2" onClick={() => onChange([])}>
              Clear
            </button>
          </div>
          <ul className="max-h-[40vh] space-y-0.5 overflow-y-auto">
            {shown.map((t) => (
              <li key={t.id}>
                <label className="flex items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-accent">
                  <input type="checkbox" checked={isOn(t.id)} onChange={() => toggle(t.id)} className="size-4" />
                  {t.name}
                </label>
              </li>
            ))}
            {shown.length === 0 && <li className="px-1 text-xs text-muted-foreground">No match</li>}
          </ul>
        </div>
      </details>
    </div>
  );
}
