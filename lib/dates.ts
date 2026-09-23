// Date helpers. Roster dates are plain "YYYY-MM-DD" strings handled in UTC so a day is always a day.

const MS_PER_DAY = 86_400_000;

export function dayIndex(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

export function fromDayIndex(index: number): string {
  return new Date(index * MS_PER_DAY).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return fromDayIndex(dayIndex(date) + days);
}

export function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && fromDayIndex(dayIndex(date)) === date;
}

/** 0 = Sunday ... 6 = Saturday */
export function weekday(date: string): number {
  return new Date(dayIndex(date) * MS_PER_DAY).getUTCDay();
}

export function isWeekend(date: string): boolean {
  const w = weekday(date);
  return w === 0 || w === 6;
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let i = dayIndex(from); i <= dayIndex(to); i++) out.push(fromDayIndex(i));
  return out;
}

/** month is "YYYY-MM" */
export function monthDates(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const first = `${month}-01`;
  const last = fromDayIndex(Math.round(Date.UTC(y, m, 1) / MS_PER_DAY) - 1);
  return dateRange(first, last);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function isValidMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

/** Today in the server or browser local time zone. */
export function todayLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function weekdayShort(date: string): string {
  return WEEKDAYS[weekday(date)];
}

export function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${weekdayShort(date)} ${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatDateShort(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** Collapse a sorted list of dates into readable runs: "3-5 Oct, 9 Oct". */
export function formatDateList(dates: string[]): string {
  if (dates.length === 0) return "";
  const sorted = [...dates].sort();
  const runs: [string, string][] = [];
  for (const date of sorted) {
    const last = runs[runs.length - 1];
    if (last && dayIndex(date) === dayIndex(last[1]) + 1) last[1] = date;
    else runs.push([date, date]);
  }
  return runs
    .map(([a, b]) => {
      if (a === b) return formatDateShort(a);
      const [, am, ad] = a.split("-").map(Number);
      const [, bm, bd] = b.split("-").map(Number);
      return am === bm ? `${ad}-${bd} ${MONTHS[bm - 1]}` : `${formatDateShort(a)} - ${formatDateShort(b)}`;
    })
    .join(", ");
}
