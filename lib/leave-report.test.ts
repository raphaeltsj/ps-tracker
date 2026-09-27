import assert from "node:assert/strict";
import { test } from "node:test";
import { tallyLeaveTaken } from "./leave-report";
import type { RosterCell } from "./roster-types";

const cell = (absences: RosterCell["absences"]): RosterCell => ({ duty: "AM", dutySource: "cycle", dos: null, task: null, absences, swap: null });

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
