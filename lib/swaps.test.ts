import assert from "node:assert/strict";
import { test } from "node:test";
import { dateRange, dayIndex } from "./dates";
import type { AssignableDuty } from "./domain";
import { dutiesDiffer, makeDutyResolver, previewSwap, type PersonCycle } from "./swaps";

// Same anchors as the spec's table: 1-6 Jan 2026 is A: PM PM AM AM Off Off, B: Off Off PM PM AM AM,
// C: AM AM Off Off PM PM.
const DAY1 = dayIndex("2026-01-01");
const person = (anchor: number, overrides: [string, AssignableDuty][] = []): PersonCycle => ({ anchor, overrides: new Map(overrides) });

test("a same-date swap is a one-for-one exchange: A's PM for C's AM", () => {
  const people = new Map([
    ["alpha", person(DAY1)],
    ["charl", person(DAY1 - 2)],
  ]);
  const resolve = makeDutyResolver(people, [{ swapId: "s1", date: "2026-01-01", a: "alpha", b: "charl" }]);
  assert.equal(resolve("alpha", "2026-01-01").duty, "AM");
  assert.equal(resolve("charl", "2026-01-01").duty, "PM");
  assert.deepEqual(resolve("alpha", "2026-01-01").swap, { swapId: "s1", partnerId: "charl", ownDuty: "PM" });
  // Other days are untouched.
  assert.equal(resolve("alpha", "2026-01-02").duty, "PM");
  assert.equal(resolve("alpha", "2026-01-02").swap, null);
});

test("a two-date swap is give and take: each covers the other on a different date", () => {
  const people = new Map([
    ["alpha", person(DAY1)],
    ["charl", person(DAY1 - 2)],
  ]);
  const swaps = ["2026-01-03", "2026-01-05"].map((date) => ({ swapId: "s1", date, a: "alpha", b: "charl" }));
  const resolve = makeDutyResolver(people, swaps);
  // 3 Jan: Alpha's AM, Charl Off. 5 Jan: Alpha Off, Charl's PM.
  assert.equal(resolve("alpha", "2026-01-03").duty, "OFF");
  assert.equal(resolve("charl", "2026-01-03").duty, "AM");
  assert.equal(resolve("alpha", "2026-01-05").duty, "PM");
  assert.equal(resolve("charl", "2026-01-05").duty, "OFF");
});

test("the Off(V) follows whoever works the V", () => {
  // Alpha (A) is on V on 5-6 Jan (A's Off days), so A's PM block on 7-8 Jan becomes Off(V).
  const people = new Map([
    ["alpha", person(DAY1, [["2026-01-05", "V"], ["2026-01-06", "V"]])],
    ["bravo", person(DAY1 - 4)],
  ]);
  const days = dateRange("2026-01-05", "2026-01-10");
  const noSwap = makeDutyResolver(people, []);
  assert.deepEqual(days.map((d) => noSwap("alpha", d).duty), ["V", "V", "OFF_V", "OFF_V", "AM", "AM"]);

  // Bravo (B, on AM those days) takes both V nights.
  const swaps = ["2026-01-05", "2026-01-06"].map((date) => ({ swapId: "s1", date, a: "alpha", b: "bravo" }));
  const resolve = makeDutyResolver(people, swaps);
  // Alpha works Bravo's AM and gets the PM block back.
  assert.deepEqual(days.map((d) => resolve("alpha", d).duty), ["AM", "AM", "PM", "PM", "AM", "AM"]);
  // Bravo works V and his next PM block (9-10 Jan) becomes Off(V).
  assert.deepEqual(days.map((d) => resolve("bravo", d).duty), ["V", "V", "OFF", "OFF", "OFF_V", "OFF_V"]);
  assert.deepEqual(resolve("bravo", "2026-01-05").swap?.ownDuty, "AM");
});

test("swapping only one of the two V nights still moves the Off(V) for the V the taker works", () => {
  const people = new Map([
    ["alpha", person(DAY1, [["2026-01-05", "V"], ["2026-01-06", "V"]])],
    ["bravo", person(DAY1 - 4)],
  ]);
  const resolve = makeDutyResolver(people, [{ swapId: "s1", date: "2026-01-06", a: "alpha", b: "bravo" }]);
  // Alpha still works V on the 5th, so the PM block stays Off(V) for him.
  assert.equal(resolve("alpha", "2026-01-07").duty, "OFF_V");
  // Bravo worked V on the 6th, so his next PM block is Off(V) too.
  assert.equal(resolve("bravo", "2026-01-09").duty, "OFF_V");
});

test("preview lists the swapped dates and the Off(V) knock-on", () => {
  const people = new Map([
    ["alpha", person(DAY1, [["2026-01-05", "V"], ["2026-01-06", "V"]])],
    ["bravo", person(DAY1 - 4)],
  ]);
  const { rows, ripples } = previewSwap(people, [], { swapId: "new", a: "alpha", b: "bravo", dates: ["2026-01-05", "2026-01-06"] }, dateRange("2026-01-05", "2026-01-12"));
  assert.deepEqual(rows[0], { date: "2026-01-05", aBefore: "V", bBefore: "AM", aAfter: "AM", bAfter: "V" });
  assert.deepEqual(ripples, [
    { staffId: "alpha", date: "2026-01-07", before: "OFF_V", after: "PM" },
    { staffId: "alpha", date: "2026-01-08", before: "OFF_V", after: "PM" },
    { staffId: "bravo", date: "2026-01-09", before: "PM", after: "OFF_V" },
    { staffId: "bravo", date: "2026-01-10", before: "PM", after: "OFF_V" },
  ]);
});

test("only different duties can be exchanged; Off and Off(V) count as the same day off", () => {
  assert.equal(dutiesDiffer("AM", "PM"), true);
  assert.equal(dutiesDiffer("AM", "OFF"), true);
  assert.equal(dutiesDiffer("V", "VSB"), true);
  assert.equal(dutiesDiffer("PM", "PM"), false);
  assert.equal(dutiesDiffer("OFF", "OFF_V"), false);
});
