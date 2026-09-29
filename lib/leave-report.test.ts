import assert from "node:assert/strict";
import { test } from "node:test";
import { tallyLeaveTaken } from "./leave-report";
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

test("leaveTakenRows counts OML in its own row and in MC's, so 3 OML leaves 11 MC days", async () => {
  const { leaveTakenRows } = await import("./leave-report");
  const tally = [
    { code: "OML", count: 3 },
    { code: "MC", count: 2 },
  ];
  const rows = leaveTakenRows(tally, tally, ["AL", "OL", "MC", "OML", "BD", "BD-IL"]);
  const mc = rows.find((r) => r.key === "MC")!;
  const oml = rows.find((r) => r.key === "OML")!;
  assert.equal(mc.annualCount, 5);
  assert.equal(mc.limit! - mc.annualCount, 9);
  assert.equal(oml.annualCount, 3);
  assert.equal(rows.filter((r) => r.label === "OML").length, 1); // not duplicated in the "everything else" rows
});
