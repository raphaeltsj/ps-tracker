import assert from "node:assert/strict";
import { test } from "node:test";
import { dateRange, dayIndex } from "./dates";
import type { AssignableDuty } from "./domain";
import { dutiesDiffer, linkedDates, makeDutyResolver, previewSwap, vThenAm, type PersonCycle } from "./swaps";

// Same anchors as the spec's table: 1-6 Jan 2026 is A: PM PM AM AM Off Off, B: Off Off PM PM AM AM,
// C: AM AM Off Off PM PM.
const DAY1 = dayIndex("2026-01-01");
const person = (anchor: number, overrides: [string, AssignableDuty][] = []): PersonCycle => ({ anchor, overrides: new Map(overrides) });

test("a same-date swap is a one-for-one exchange: A's PM for C's AM", () => {
  const people = new Map([
    ["alpha", person(DAY1)],
    ["charl", person(DAY1 - 2)],
  ]);
  const resolve = makeDutyResolver(people, [{ swapId: "s1", date: "2026-01-01", a: "alpha", b: "charl", shifts: { a: "A", b: "C" } }]);
  assert.equal(resolve("alpha", "2026-01-01").duty, "AM");
  assert.equal(resolve("charl", "2026-01-01").duty, "PM");
  assert.deepEqual(resolve("alpha", "2026-01-01").swap, { swapId: "s1", partnerId: "charl", ownDuty: "PM", partnerShiftId: "C" });
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
  // Alpha and Bravo are both in A. Alpha is on V on 5-6 Jan (A's Off days), so A's PM block on
  // 7-8 Jan becomes Off(V) for Alpha.
  const people = new Map([
    ["alpha", person(DAY1, [["2026-01-05", "V"], ["2026-01-06", "V"]])],
    ["bravo", person(DAY1)],
  ]);
  const days = dateRange("2026-01-05", "2026-01-10");
  const noSwap = makeDutyResolver(people, []);
  assert.deepEqual(days.map((d) => noSwap("alpha", d).duty), ["V", "V", "OFF_V", "OFF_V", "AM", "AM"]);

  // Bravo (Off those days) takes both V nights.
  const swaps = ["2026-01-05", "2026-01-06"].map((date) => ({ swapId: "s1", date, a: "alpha", b: "bravo" }));
  const resolve = makeDutyResolver(people, swaps);
  // Alpha is Off instead and gets the PM block back.
  assert.deepEqual(days.map((d) => resolve("alpha", d).duty), ["OFF", "OFF", "PM", "PM", "AM", "AM"]);
  // Bravo works V and the PM block (7-8 Jan) becomes his Off(V).
  assert.deepEqual(days.map((d) => resolve("bravo", d).duty), ["V", "V", "OFF_V", "OFF_V", "AM", "AM"]);
  assert.deepEqual(resolve("bravo", "2026-01-05").swap?.ownDuty, "OFF");
});

test("a V on a day that earns no Off(V) earns none for the taker either", () => {
  // Amber is on V on 3 Jan, A's 1st AM day: V off the Off days earns no Off(V) for her.
  const people = new Map([
    ["amber", person(DAY1, [["2026-01-03", "V"]])],
    ["bravo", person(DAY1)],
  ]);
  assert.equal(makeDutyResolver(people, [])("amber", "2026-01-07").duty, "PM");
  const resolve = makeDutyResolver(people, [{ swapId: "s1", date: "2026-01-03", a: "amber", b: "bravo" }]);
  assert.equal(resolve("bravo", "2026-01-07").duty, "PM");
  assert.equal(resolve("amber", "2026-01-07").duty, "PM");
});

test("preview lists the swapped dates and the Off(V) knock-on", () => {
  const people = new Map([
    ["alpha", person(DAY1, [["2026-01-05", "V"], ["2026-01-06", "V"]])],
    ["bravo", person(DAY1)],
  ]);
  const { rows, ripples } = previewSwap(people, [], { swapId: "new", a: "alpha", b: "bravo", dates: ["2026-01-05", "2026-01-06"] }, dateRange("2026-01-05", "2026-01-12"));
  assert.deepEqual(rows[0], { date: "2026-01-05", aBefore: "V", bBefore: "OFF", aAfter: "OFF", bAfter: "V" });
  assert.deepEqual(ripples, [
    { staffId: "alpha", date: "2026-01-07", before: "OFF_V", after: "PM" },
    { staffId: "alpha", date: "2026-01-08", before: "OFF_V", after: "PM" },
    { staffId: "bravo", date: "2026-01-07", before: "PM", after: "OFF_V" },
    { staffId: "bravo", date: "2026-01-08", before: "PM", after: "OFF_V" },
  ]);
});

test("only different duties can be exchanged; Off and Off(V) count as the same day off", () => {
  assert.equal(dutiesDiffer("AM", "PM"), true);
  assert.equal(dutiesDiffer("AM", "OFF"), true);
  assert.equal(dutiesDiffer("V", "VSB"), true);
  assert.equal(dutiesDiffer("PM", "PM"), false);
  assert.equal(dutiesDiffer("OFF", "OFF_V"), false);
});

test("a V night followed by AM at 0745 the next morning is caught (no rest)", () => {
  // Bravo (B) is on AM on 5-6 Jan. Taking only Alpha's V on the 5th leaves Bravo's AM on the 6th.
  const people = new Map([
    ["alpha", person(DAY1, [["2026-01-05", "V"], ["2026-01-06", "V"]])],
    ["bravo", person(DAY1 - 4)],
  ]);
  const oneNight = makeDutyResolver(people, [{ swapId: "s1", date: "2026-01-05", a: "alpha", b: "bravo" }]);
  assert.equal(vThenAm((d) => oneNight("bravo", d).duty, dateRange("2026-01-04", "2026-01-06")), "2026-01-05");
  // Taking both nights is fine: V, V, then Off.
  const bothNights = makeDutyResolver(people, ["2026-01-05", "2026-01-06"].map((date) => ({ swapId: "s1", date, a: "alpha", b: "bravo" })));
  assert.equal(vThenAm((d) => bothNights("bravo", d).duty, dateRange("2026-01-04", "2026-01-07")), null);
  // Alpha, now on AM 5-6 Jan, is fine too.
  assert.equal(vThenAm((d) => bothNights("alpha", d).duty, dateRange("2026-01-04", "2026-01-07")), null);
});

test("a swap keeps the shifts both people were in when it was made", () => {
  // Charl moves from C to B after the swap was approved: the swap still exchanges C's duty.
  const people = new Map([
    ["alpha", person(DAY1)],
    ["charl", person(DAY1 - 4)], // now in B
  ]);
  const swap = { swapId: "s1", date: "2026-01-01", a: "alpha", b: "charl", anchors: { a: DAY1, b: DAY1 - 2 } };
  const resolve = makeDutyResolver(people, [swap]);
  assert.equal(resolve("alpha", "2026-01-01").duty, "AM"); // C's AM, not B's Off
  assert.equal(resolve("charl", "2026-01-01").duty, "PM");
});

test("a same-shift V swap: the PM days after it are follow-on days of the swap", () => {
  // Alpha and Bravo are both in A. Alpha is on V 5-6 Jan (A's Off days); Bravo takes both nights.
  const people = new Map([
    ["alpha", person(DAY1, [["2026-01-05", "V"], ["2026-01-06", "V"]])],
    ["bravo", person(DAY1)],
  ]);
  const exchange = ["2026-01-05", "2026-01-06"].map((date) => ({ swapId: "s1", date, a: "alpha", b: "bravo" }));
  const { ripples } = previewSwap(people, [], { swapId: "s1", a: "alpha", b: "bravo", dates: ["2026-01-05", "2026-01-06"] }, dateRange("2026-01-05", "2026-01-12"));
  const follow = linkedDates(ripples);
  assert.deepEqual(follow, ["2026-01-07", "2026-01-08"]); // A's PM block after the V
  const resolve = makeDutyResolver(people, [...exchange, ...follow.map((date) => ({ swapId: "s1", date, a: "alpha", b: "bravo", linked: true }))]);
  // The PM days are swapped: Bravo gets the Off(V), Alpha works PM, and both carry the swap tag.
  assert.equal(resolve("bravo", "2026-01-07").duty, "OFF_V");
  assert.deepEqual(resolve("bravo", "2026-01-07").swap, { swapId: "s1", partnerId: "alpha", ownDuty: "PM", partnerShiftId: undefined, linked: true });
  assert.equal(resolve("alpha", "2026-01-07").duty, "PM");
  assert.equal(resolve("alpha", "2026-01-07").swap?.ownDuty, "OFF_V");
  // The V nights themselves are exchanged as before.
  assert.equal(resolve("bravo", "2026-01-05").duty, "V");
  assert.equal(resolve("alpha", "2026-01-05").duty, "OFF");
});
