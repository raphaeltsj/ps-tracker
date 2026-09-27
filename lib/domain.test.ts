import assert from "node:assert/strict";
import { test } from "node:test";
import { birthdayEvents } from "./birthday";
import { cycleDayLabel, cyclePositionLabel, dosEarnsOil, effectiveDuty, shiftDutyOn } from "./cycle";
import { addDays, dateRange, dayIndex, formatDateList, formatDateTime } from "./dates";
import { ASSIGNABLE_DUTIES, type AssignableDuty } from "./domain";
import { computeStrength, formatFigure, mflFor, V_MFL } from "./strength";

const DAY1 = dayIndex("2026-01-01");
const ANCHORS = { A: DAY1, B: DAY1 - 4, C: DAY1 - 2 };

test("the three shifts follow the spec's 6-day table (section 3.2)", () => {
  const days = dateRange("2026-01-01", "2026-01-06");
  assert.deepEqual(days.map((d) => shiftDutyOn(ANCHORS.A, d)), ["PM", "PM", "AM", "AM", "OFF", "OFF"]);
  assert.deepEqual(days.map((d) => shiftDutyOn(ANCHORS.B, d)), ["OFF", "OFF", "PM", "PM", "AM", "AM"]);
  assert.deepEqual(days.map((d) => shiftDutyOn(ANCHORS.C, d)), ["AM", "AM", "OFF", "OFF", "PM", "PM"]);
});

test("cycle day labels read 1st / 2nd", () => {
  assert.equal(cycleDayLabel(ANCHORS.A, "2026-01-01"), "1st PM");
  assert.equal(cycleDayLabel(ANCHORS.A, "2026-01-04"), "2nd AM");
  assert.equal(cycleDayLabel(ANCHORS.A, "2026-01-06"), "2nd OFF");
  assert.equal(cyclePositionLabel(ANCHORS.A, "2026-01-01"), "1st PM, next: AM");
  assert.equal(cyclePositionLabel(ANCHORS.A, "2026-01-04"), "2nd AM, next: OFF");
});

test("a DOS/FDO duty earns the next-day 0.5 OIL only on a 1st AM", () => {
  assert.equal(dosEarnsOil(ANCHORS.A, "2026-01-03"), true); // 1st AM, next day is the 2nd AM
  assert.equal(dosEarnsOil(ANCHORS.A, "2026-01-04"), false); // 2nd AM, next day is Off anyway
});

test("V duty turns the following PM block into Off(V), section 5", () => {
  const overrides = new Map<string, AssignableDuty>([
    ["2026-01-05", "V"],
    ["2026-01-06", "V"],
  ]);
  const duties = dateRange("2026-01-01", "2026-01-12").map((d) => effectiveDuty(ANCHORS.A, d, overrides).duty);
  assert.deepEqual(duties, ["PM", "PM", "AM", "AM", "V", "V", "OFF_V", "OFF_V", "AM", "AM", "OFF", "OFF"]);
  // Cancelling the V duty puts the PM block back: nothing about it is stored.
  assert.equal(effectiveDuty(ANCHORS.A, "2026-01-07", new Map()).duty, "PM");
});

test("an Off assigned by a supervisor is an Off(V); AM and PM cannot be assigned", () => {
  const overrides = new Map<string, AssignableDuty>([["2026-01-01", "OFF"]]);
  assert.equal(effectiveDuty(ANCHORS.A, "2026-01-01", overrides).duty, "OFF_V");
  assert.deepEqual([...ASSIGNABLE_DUTIES], ["V", "VSB", "OFF"]);
});

test("V always needs exactly 1 person", () => {
  assert.equal(V_MFL, 1);
  assert.equal(mflFor("AM", "2026-09-22"), 13);
});

test("slot colours: red at none or below MFL, yellow at 1-2, green above", () => {
  assert.equal(computeStrength(13, 0, 13).status, "zero"); // red
  assert.equal(computeStrength(13, 1, 13).status, "below"); // red
  assert.equal(computeStrength(14, 0, 13).status, "low"); // 1 left, yellow
  assert.equal(computeStrength(15, 0, 13).status, "low"); // 2 left, yellow
  assert.equal(computeStrength(15, 0.5, 13).status, "low"); // 1.5 left, yellow
  assert.equal(computeStrength(16, 0, 13).status, "healthy"); // 3 left, green
});

test("worked example: weekday PM, total 26, 4 full + 1 half-day leave", () => {
  const date = "2026-09-22"; // Tuesday
  const s = computeStrength(26, 4.5, mflFor("PM", date));
  assert.equal(s.notIn, 4.5);
  assert.equal(formatFigure(s.working), "21.5");
  assert.equal(formatFigure(s.slots), "9.5");
  assert.equal(s.status, "healthy");
});

test("Rest day: MFL blank, slots = total - not in", () => {
  const s = computeStrength(26, 3, mflFor("OFF", "2026-09-22"));
  assert.equal(s.mfl, null);
  assert.equal(s.working, 23);
  assert.equal(s.slots, 23);
});

test("weekend MFL and slot status bands", () => {
  assert.equal(mflFor("AM", "2026-09-26"), 14); // Saturday
  assert.equal(mflFor("PM", "2026-09-27"), 11); // Sunday
  assert.equal(computeStrength(14, 0, 12).status, "low");
  assert.equal(computeStrength(12, 0, 12).status, "zero");
  assert.equal(computeStrength(12, 1, 12).status, "below");
});

test("birthday on an Off day: BD marker, BD-IL on the next working day", () => {
  const dutyOn = (d: string) => effectiveDuty(ANCHORS.A, d, new Map()).duty;
  const events = birthdayEvents("1990-01-05", 2026, dutyOn);
  assert.deepEqual(events, [
    { date: "2026-01-05", code: "BD", counts: false },
    { date: "2026-01-07", code: "BD-IL", counts: true },
  ]);
  assert.deepEqual(birthdayEvents("1990-01-03", 2026, dutyOn), [{ date: "2026-01-03", code: "BD", counts: true }]);
});

test("one leave type per day: BD-IL skips working days that already have leave", () => {
  const dutyOn = (d: string) => effectiveDuty(ANCHORS.A, d, new Map()).duty;
  // Birthday 5 Jan is Off; 7 Jan (PM) already has leave, so BD-IL moves to 8 Jan.
  assert.deepEqual(birthdayEvents("1990-01-05", 2026, dutyOn, (d) => d === "2026-01-07"), [
    { date: "2026-01-05", code: "BD", counts: false },
    { date: "2026-01-08", code: "BD-IL", counts: true },
  ]);
});

test("date helpers", () => {
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
  assert.equal(formatDateList(["2026-10-03", "2026-10-04", "2026-10-05", "2026-10-09"]), "3-5 Oct, 9 Oct");
});

test("timestamps and today follow Singapore time, not the server's", () => {
  // 17:30 UTC on 27 Sep is 01:30 on Mon 28 Sep in Singapore.
  assert.equal(formatDateTime("2026-09-27T17:30:00Z"), "Mon 28 Sep, 01:30");
});
