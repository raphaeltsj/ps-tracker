// The year / month / date-range filter shared by the Task report and the Dayworker report.
import { dayIndex, fromDayIndex, isValidDate, isValidMonth, monthDates } from "@/lib/dates";

export type Period = "year" | "month" | "range";

export const MAX_RANGE_DAYS = 366 * 3;

export type ResolvedPeriod = {
  period: Period;
  year: string;
  month: string;
  from: string;
  to: string;
  /** Set when a range was swapped or shortened, so the page can say so */
  rangeError: string | null;
  includeScheduled: boolean;
  /** Last day counted: "done" means up to today unless scheduled days are included */
  countTo: string;
};

/**
 * Reads the period from query parameters. Defaults to the current month. A reversed range is
 * swapped, and a range longer than 3 years is shortened, each with a message.
 */
export function resolveReportPeriod(param: (key: string) => string, today: string): ResolvedPeriod {
  const period: Period = param("period") === "year" || param("period") === "range" ? (param("period") as Period) : "month";
  const year = /^\d{4}$/.test(param("year")) ? param("year") : today.slice(0, 4);
  const month = isValidMonth(param("month")) ? param("month") : today.slice(0, 7);

  let from: string;
  let to: string;
  let rangeError: string | null = null;
  if (period === "year") {
    [from, to] = [`${year}-01-01`, `${year}-12-31`];
  } else if (period === "range") {
    from = isValidDate(param("from")) ? param("from") : `${today.slice(0, 7)}-01`;
    to = isValidDate(param("to")) ? param("to") : today;
    if (from > to) {
      rangeError = "The start date is after the end date.";
      [from, to] = [to, from];
    }
    if (dayIndex(to) - dayIndex(from) > MAX_RANGE_DAYS) {
      rangeError = "Ranges are limited to 3 years, so the end date was shortened.";
      to = fromDayIndex(dayIndex(from) + MAX_RANGE_DAYS);
    }
  } else {
    const days = monthDates(month);
    [from, to] = [days[0], days[days.length - 1]];
  }

  const includeScheduled = param("scheduled") === "1";
  const countTo = includeScheduled || to < today ? to : today;
  return { period, year, month, from, to, rangeError, includeScheduled, countTo };
}
