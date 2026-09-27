import assert from "node:assert/strict";
import { test } from "node:test";
import { DAYWORKER_USERNAME_MAX, normalizeDayworkerName, normalizeUsername } from "./dayworkers";
import { MAX_RANGE_DAYS, resolveReportPeriod } from "./report-period";
import { dayIndex } from "./dates";

test("dayworker usernames are at most 7 characters, shown in capitals", () => {
  assert.equal(DAYWORKER_USERNAME_MAX, 7);
  assert.deepEqual(normalizeUsername("tyl"), { ok: true, username: "TYL" });
  assert.deepEqual(normalizeUsername("  cmt "), { ok: true, username: "CMT" });
  assert.deepEqual(normalizeUsername("glint07"), { ok: true, username: "GLINT07" }); // exactly 7
  assert.equal(normalizeUsername("glint007").ok, false); // 8 characters
});

test("dayworker usernames reject blanks and spaces", () => {
  assert.equal(normalizeUsername("").ok, false);
  assert.equal(normalizeUsername("   ").ok, false);
  assert.equal(normalizeUsername("ab cd").ok, false);
  assert.equal(normalizeUsername(undefined).ok, false);
});

test("dayworker names are trimmed, collapsed and length-limited", () => {
  assert.equal(normalizeDayworkerName("  Comet   Ray "), "Comet Ray");
  assert.equal(normalizeDayworkerName("   "), null);
  assert.equal(normalizeDayworkerName("x".repeat(41)), null);
});

const params = (values: Record<string, string>) => (key: string) => values[key] ?? "";

test("report period defaults to the current month and counts up to today", () => {
  const p = resolveReportPeriod(params({}), "2026-09-23");
  assert.equal(p.period, "month");
  assert.equal(p.from, "2026-09-01");
  assert.equal(p.to, "2026-09-30");
  assert.equal(p.countTo, "2026-09-23");
  assert.equal(resolveReportPeriod(params({ scheduled: "1" }), "2026-09-23").countTo, "2026-09-30");
});

test("report period: a year, a past month, and range clean-up", () => {
  const year = resolveReportPeriod(params({ period: "year", year: "2025" }), "2026-09-23");
  assert.deepEqual([year.from, year.to, year.countTo], ["2025-01-01", "2025-12-31", "2025-12-31"]);

  const swapped = resolveReportPeriod(params({ period: "range", from: "2026-09-20", to: "2026-09-10" }), "2026-09-23");
  assert.deepEqual([swapped.from, swapped.to], ["2026-09-10", "2026-09-20"]);
  assert.ok(swapped.rangeError);

  const long = resolveReportPeriod(params({ period: "range", from: "2020-01-01", to: "2026-09-01" }), "2026-09-23");
  assert.equal(dayIndex(long.to) - dayIndex(long.from), MAX_RANGE_DAYS);
  assert.ok(long.rangeError);
});
