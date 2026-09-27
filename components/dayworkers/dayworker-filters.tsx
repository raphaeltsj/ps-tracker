"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Period } from "@/lib/report-period";
import { cn } from "@/lib/utils";

type Props = { period: Period; year: string; month: string; from: string; to: string; includeScheduled: boolean; years: number[] };

/** Year, month or date-range filter for the dayworker duty count. State lives in the URL. */
export function DayworkerFilters(props: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [period, setPeriod] = useState<Period>(props.period);
  const [year, setYear] = useState(props.year);
  const [month, setMonth] = useState(props.month);
  const [from, setFrom] = useState(props.from);
  const [to, setTo] = useState(props.to);
  const [scheduled, setScheduled] = useState(props.includeScheduled);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const q = new URLSearchParams({ period });
    if (period === "year") q.set("year", year);
    if (period === "month") q.set("month", month);
    if (period === "range") {
      q.set("from", from);
      q.set("to", to);
    }
    if (scheduled) q.set("scheduled", "1");
    router.push(`${pathname}?${q.toString()}`);
  }

  const label = "text-xs font-medium text-muted-foreground";
  return (
    <form onSubmit={apply} className="flex flex-wrap items-end gap-3 rounded-xl border p-3">
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

      <label className="flex items-center gap-2 pb-2 text-sm">
        <input type="checkbox" checked={scheduled} onChange={(e) => setScheduled(e.target.checked)} className="size-4" />
        Include scheduled duty (after today)
      </label>

      <Button type="submit" className="ml-auto">
        Apply
      </Button>
    </form>
  );
}
