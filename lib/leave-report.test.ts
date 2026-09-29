import assert from "node:assert/strict";
import { test } from "node:test";
import { leaveTakenRows, tallyLeaveTaken } from "./leave-report";
import type { RosterCell } from "./roster-types";

const cell = (absences: RosterCell["absences"]): RosterCell => ({ duty: "AM", dutySource: "cycle", dos: null, task: null, absences, swap: null, dutyOnLeave: false });

test("tallyLeaveTaken counts only approved leave, half-day at 0.5", () => {
  const cells: Record<string, RosterCell> = {
    "2026-09-01": cell([{ leaveId: "1", code: "AL", half: null, status: "APPROVED", counts: 1, derived: false }]),
    "2026-09-02": cell([{ leaveId: "2", code: "AL", half: "FIRST", status: "APPROVED", counts: 0.5, derived: false }]),
    "2026-09-03": cell([{ leaveId: "3", code: "MC", half: null, status: "PENDING", counts: 1, derived: false }]), // not counted
    "2026-09-04": cell([{ leaveId: null, code: "BD", half: null, status: "APPROVED", counts: 0, derived: true }]), // marker only, not counted
  };
  const { total, byType } = tallyLeaveTaken(cells, Object.keys(cells));
  assert.equal(total, 1.5);
  assert.deepEqual(byType, [{ code: "AL", count: 1.5 }]);
});

test("GRW has a combined limit of 7 (half days fold in); the OIL row carries the person's own allowance", () => {
  const taken = [
    { code: "GRW", count: 2 },
    { code: "0.5 GRW", count: 0.5 },
    { code: "1 OIL", count: 1 },
  ];
  const rows = leaveTakenRows(taken, taken, ["AL", "GRW", "OIL"], { allowed: 3, used: 1, left: 2 });
  const grw = rows.find((r) => r.key === "GRW")!;
  assert.equal(grw.limit, 7);
  assert.equal(grw.annualCount, 2.5);
  const oil = rows.find((r) => r.key === "OIL")!;
  assert.equal(oil.limit, null);
  assert.deepEqual(oil.oil, { allowed: 3, used: 1, left: 2 });
  // Without a balance (e.g. a report that doesn't load it) the OIL row is a plain count.
  assert.equal(leaveTakenRows(taken, taken, ["OIL"]).find((r) => r.key === "OIL")!.oil, undefined);
});

test("tallyLeaveTaken sums BD-IL (a real approved leave day) and sorts by count", () => {
  const cells: Record<string, RosterCell> = {
    "2026-09-01": cell([{ leaveId: "1", code: "MC", half: null, status: "APPROVED", counts: 1, derived: false }]),
    "2026-09-02": cell([{ leaveId: "2", code: "MC", half: null, status: "APPROVED", counts: 1, derived: false }]),
    "2026-09-03": cell([{ leaveId: "3", code: "BD-IL", half: null, status: "APPROVED", counts: 1, derived: true }]),
  };
  const { total, byType } = tallyLeaveTaken(cells, Object.keys(cells));
  assert.equal(total, 3);
  assert.deepEqual(byType, [
    { code: "MC", count: 2 },
    { code: "BD-IL", count: 1 },
  ]);
});
