import "server-only";
import { birthdayEvents } from "@/lib/birthday";
import { effectiveDuty, shiftDutyOn } from "@/lib/cycle";
import { addDays, dateRange } from "@/lib/dates";
import { db } from "@/lib/db";
import type { AssignableDuty, Half, LeaveStatus, Role } from "@/lib/domain";
import type { Prisma } from "@/lib/generated/prisma/client";
import { canEditShift, type Viewer } from "@/lib/permissions";
import type { CellAbsence, LeaveSummary, RosterCell, RosterData, RosterDay } from "@/lib/roster-types";
import { computeStrength, mflFor } from "@/lib/strength";

const leaveInclude = {
  type: true,
  staff: { select: { name: true, shiftId: true } },
  givenBy: { select: { name: true } },
  days: { select: { date: true }, orderBy: { date: "asc" } },
} satisfies Prisma.LeaveInclude;

type LeaveWithRelations = Prisma.LeaveGetPayload<{ include: typeof leaveInclude }>;

export function toLeaveSummary(leave: LeaveWithRelations): LeaveSummary {
  return {
    id: leave.id,
    staffId: leave.staffId,
    staffName: leave.staff.name,
    shiftId: leave.staff.shiftId,
    typeCode: leave.typeCode,
    typeName: leave.type.name,
    halfDay: leave.type.halfDay,
    half: leave.half as Half | null,
    status: leave.status as LeaveStatus,
    notes: leave.notes,
    remarks: leave.remarks,
    rejectReason: leave.rejectReason,
    givenByName: leave.givenBy?.name ?? null,
    submittedAt: leave.submittedAt.toISOString(),
    days: leave.days.map((d) => d.date),
  };
}

export async function getLeaveSummary(id: string): Promise<LeaveSummary | null> {
  const leave = await db.leave.findUnique({ where: { id }, include: leaveInclude });
  return leave ? toLeaveSummary(leave) : null;
}

export async function getMyLeaves(staffId: string): Promise<LeaveSummary[]> {
  const leaves = await db.leave.findMany({
    where: { staffId },
    include: leaveInclude,
    orderBy: { submittedAt: "desc" },
  });
  return leaves.map(toLeaveSummary);
}

/**
 * Builds everything the roster, calendar and strength rows need for one shift over a date range.
 * Pending leave is only included for its owner and for people who can edit the shift.
 */
export async function buildRoster(shiftId: string, from: string, to: string, viewer: Viewer | null): Promise<RosterData> {
  const shift = await db.shift.findUniqueOrThrow({ where: { id: shiftId } });
  const dates = dateRange(from, to);
  // Overrides a little either side: post-V looks back up to 3 days, BD-IL looks ahead up to 14.
  const loadFrom = addDays(from, -21);
  const loadTo = addDays(to, 14);

  const staff = await db.staff.findMany({
    where: { shiftId, active: true, role: { not: "MANAGEMENT" } },
    orderBy: [{ role: "desc" }, { name: "asc" }],
  });
  const staffIds = staff.map((s) => s.id);

  const [overrides, leaves, tasks, locks, events, vCounts] = await Promise.all([
    db.dutyOverride.findMany({ where: { staffId: { in: staffIds }, date: { gte: loadFrom, lte: loadTo } } }),
    db.leave.findMany({
      where: {
        staffId: { in: staffIds },
        status: { in: ["APPROVED", "PENDING"] },
        days: { some: { date: { gte: from, lte: to } } },
      },
      include: leaveInclude,
    }),
    db.taskAssignment.findMany({
      where: { staffId: { in: staffIds }, date: { gte: from, lte: to } },
      include: { task: true },
    }),
    db.lockedDate.findMany({ where: { shiftId, date: { gte: from, lte: to } } }),
    db.specialEvent.findMany({ where: { shiftId, date: { gte: from, lte: to } } }),
    db.vHeadcount.findMany({ where: { shiftId, date: { gte: from, lte: to } } }),
  ]);

  const editor = viewer ? canEditShift(viewer, shiftId) : false;
  const visibleLeaves = leaves.filter((l) => l.status === "APPROVED" || editor || l.staffId === viewer?.id);

  const overridesByStaff = new Map<string, Map<string, AssignableDuty>>();
  for (const o of overrides) {
    if (!overridesByStaff.has(o.staffId)) overridesByStaff.set(o.staffId, new Map());
    overridesByStaff.get(o.staffId)!.set(o.date, o.duty as AssignableDuty);
  }

  const cells: RosterData["cells"] = {};
  const notIn = new Map<string, number>(dates.map((d) => [d, 0]));
  const vOnDuty = new Map<string, number>(dates.map((d) => [d, 0]));
  const dateSet = new Set(dates);

  for (const person of staff) {
    const personOverrides = overridesByStaff.get(person.id) ?? new Map<string, AssignableDuty>();
    const dutyOn = (date: string) => effectiveDuty(shift.cycleAnchor, date, personOverrides);
    const row: Record<string, RosterCell> = {};
    for (const date of dates) {
      const { duty, source } = dutyOn(date);
      row[date] = { duty, dutySource: source, task: null, absences: [] };
      if (duty === "V") vOnDuty.set(date, vOnDuty.get(date)! + 1);
    }

    for (const leave of visibleLeaves.filter((l) => l.staffId === person.id)) {
      const approved = leave.status === "APPROVED";
      for (const { date } of leave.days) {
        if (!dateSet.has(date)) continue;
        row[date].absences.push({
          leaveId: leave.id,
          code: leave.typeCode,
          half: leave.half as Half | null,
          status: leave.status as LeaveStatus,
          counts: approved ? (leave.type.halfDay ? 0.5 : 1) : 0,
          derived: false,
        });
      }
    }

    if (person.birthday) {
      const years = new Set([Number(from.slice(0, 4)) - 1, Number(from.slice(0, 4)), Number(to.slice(0, 4))]);
      for (const year of years) {
        for (const ev of birthdayEvents(person.birthday, year, (d) => dutyOn(d).duty)) {
          if (!dateSet.has(ev.date)) continue;
          row[ev.date].absences.push({
            leaveId: null,
            code: ev.code,
            half: null,
            status: "APPROVED",
            counts: ev.counts ? 1 : 0,
            derived: true,
          } satisfies CellAbsence);
        }
      }
    }

    for (const date of dates) {
      // One person is at most 1 absence per day, even with overlapping records.
      const counted = Math.min(1, row[date].absences.reduce((sum, a) => sum + a.counts, 0));
      notIn.set(date, notIn.get(date)! + counted);
    }
    cells[person.id] = row;
  }

  for (const t of tasks) {
    const cell = cells[t.staffId]?.[t.date];
    // No Task on full-day leave (actions remove them too; this guards derived BD / BD-IL).
    if (cell && !cell.absences.some((a) => a.counts >= 1)) cell.task = { id: t.task.id, name: t.task.name };
  }

  const lockByDate = new Map(locks.map((l) => [l.date, l.remarks]));
  const eventByDate = new Map(events.map((e) => [e.date, { reportTime: e.reportTime, note: e.note }]));
  const vByDate = new Map(vCounts.map((v) => [v.date, v.count]));

  const days: Record<string, RosterDay> = {};
  for (const date of dates) {
    const shiftDuty = shiftDutyOn(shift.cycleAnchor, date);
    days[date] = {
      date,
      shiftDuty,
      // TODO(open item): Total Strength is the whole shift headcount per spec, including people
      // temporarily on V or post-V Off.
      strength: computeStrength(staff.length, notIn.get(date)!, mflFor(shiftDuty, date)),
      v: shiftDuty === "OFF" ? { onDuty: vOnDuty.get(date)!, mfl: vByDate.get(date) ?? 1 } : null,
      locked: lockByDate.get(date) ?? null,
      event: eventByDate.get(date) ?? null,
    };
  }

  return {
    shiftId,
    shiftName: shift.name,
    anchor: shift.cycleAnchor,
    dates,
    staff: staff.map((s) => ({ id: s.id, name: s.name, role: s.role as Role, birthday: s.birthday })),
    cells,
    days,
    leaves: Object.fromEntries(
      visibleLeaves.map((l) => {
        const summary = toLeaveSummary(l);
        // Notes are between the person and their supervisor.
        if (!editor && l.staffId !== viewer?.id) Object.assign(summary, { notes: null, rejectReason: null });
        return [l.id, summary];
      }),
    ),
  };
}
