"use client";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SELECT = "h-9 rounded-md border bg-background px-2 text-sm";

/**
 * A month as "YYYY-MM" from two native selects. Used instead of <input type="month">, which desktop
 * Firefox and Safari don't support (they show a plain text box).
 */
export function MonthPicker({ value, onChange, years }: { value: string; onChange: (value: string) => void; years: number[] }) {
  const [y, m] = value.split("-");
  const yearOptions = [...new Set([...years, Number(y)])].filter(Number.isFinite).sort((a, b) => a - b);
  return (
    <div className="flex gap-1.5" role="group" aria-label="Month">
      <select aria-label="Month" value={m} onChange={(e) => onChange(`${y}-${e.target.value}`)} className={SELECT}>
        {MONTHS.map((name, i) => {
          const mm = String(i + 1).padStart(2, "0");
          return (
            <option key={mm} value={mm}>
              {name}
            </option>
          );
        })}
      </select>
      <select aria-label="Year" value={y} onChange={(e) => onChange(`${e.target.value}-${m}`)} className={SELECT}>
        {yearOptions.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </div>
  );
}
