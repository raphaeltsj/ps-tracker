import "server-only";
import { birthdayEvents } from "@/lib/birthday";
import { shiftDutyOn } from "@/lib/cycle";
import { addDays, dateRange } from "@/lib/dates";
import { db } from "@/lib/db";
import type { AssignableDuty, DosKind, Half, LeaveStatus, Role } from "@/lib/domain";
import type { Prisma } from "@/lib/generated/prisma/client";
import { canEditShift, type Viewer } from "@/lib/permissions";
import type { CellAbsence, LeaveSummary, RosterCell, RosterData, RosterDay } from "@/lib/roster-types";
import { computeStrength, mflFor, V_MFL } from "@/lib/strength";
import { loadDutyContext } from "@/lib/swap-data";
import type { PersonCycle } from "@/lib/swaps";

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
    auto: leave.autoFor !== null,
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
export async function buildRoster(
  shiftId: string,
  from: string,
  to: string,
  viewer: Viewer | null,
  /** Only these people (for checks on one person). Strength figures then cover only them. */
  opts: { staffIds?: string[] } = {},
): Promise<RosterData> {
  const shift = await db.shift.findUniqueOrThrow({ where: { id: shiftId } });
  const dates = dateRange(from, to);
  // Load a little either side: post-V looks back up to 3 days, BD-IL looks ahead up to 21.
  const loadFrom = addDays(from, -21);
  const loadTo = addDays(to, 21);

  const staff = await db.staff.findMany({
    where: { shiftId, active: true, role: { not: "MANAGEMENT" }, id: opts.staffIds ? { in: opts.staffIds } : undefined },
    orderBy: [{ role: "desc" }, { name: "asc" }],
  });
  const staffIds = staff.map((s) => s.id);

  const [overrides, leaves, tasks, locks, events, extraDuties, opsDuties, extraShift] = await Promise.all([
    db.dutyOverride.findMany({ where: { staffId: { in: staffIds }, date: { gte: loadFrom, lte: loadTo } } }),
    db.leave.findMany({
      where: {
        staffId: { in: staffIds },
        status: { in: ["APPROVED", "PENDING"] },
        days: { some: { date: { gte: loadFrom, lte: loadTo } } },
      },
      include: leaveInclude,
    }),
    db.taskAssignment.findMany({
      where: { staffId: { in: staffIds }, date: { gte: from, lte: to } },
      include: { task: true },
    }),
    db.lockedDate.findMany({ where: { shiftId, date: { gte: from, lte: to } } }),
    db.specialEvent.findMany({ where: { shiftId, date: { gte: from, lte: to } } }),
    db.extraDuty.findMany({ where: { staffId: { in: staffIds }, date: { gte: from, lte: to } } }),
    // Bottom rows: dayworkers clocking Ops duty, and people from other shifts serving Extra (visible to everyone).
    db.opsDuty.findMany({ where: { shiftId, date: { gte: from, lte: to } }, include: { dayworker: true } }),
    db.extraShiftDuty.findMany({ where: { hostShiftId: shiftId, date: { gte: from, lte: to } }, include: { staff: true } }),
  ]);

  const editor = viewer ? canEditShift(viewer, shiftId) : false;
  const visibleLeaves = leaves.filter((l) => l.status === "APPROVED" || editor || l.staffId === viewer?.id);

  const overridesByStaff = new Map<string, Map<string, AssignableDuty>>();
  for (const o of overrides) {
    if (!overridesByStaff.has(o.staffId)) overridesByStaff.set(o.staffId, new Map());
    overridesByStaff.get(o.staffId)!.set(o.date, o.duty as AssignableDuty);
  }

  // Approved duty swaps (spec 11.4): partners may come from other shifts, so load their cycles too.
  const known = new Map<string, PersonCycle>(
    staff.map((s) => [s.id, { anchor: shift.cycleAnchor, overrides: overridesByStaff.get(s.id) ?? new Map<string, AssignableDuty>() }]),
  );
  const duties = await loadDutyContext(staffIds, loadFrom, loadTo, { known });

  const cells: RosterData["cells"] = {};
  const notIn = new Map<string, number>(dates.map((d) => [d, 0]));
  const vOnDuty = new Map<string, number>(dates.map((d) => [d, 0]));
  const dateSet = new Set(dates);

  for (const person of staff) {
    const dutyOn = (date: string) => duties.resolve(person.id, date);
    // All approved/pending leave days (visible or not), so BD / BD-IL land the same for every viewer.
    // A swapped day is never free for BD-IL either: no leave on a swapped day (spec 11.4).
    const leaveDates = new Set(leaves.filter((l) => l.staffId === person.id).flatMap((l) => l.days.map((d) => d.date)));
    const row: Record<string, RosterCell> = {};
    for (const date of dates) {
      const { duty, source, swap } = dutyOn(date);
      const partner = swap ? duties.byId.get(swap.partnerId) : undefined;
      row[date] = {
        duty,
        dutySource: source,
        dos: null,
        task: null,
        absences: [],
        swap: swap && partner ? { swapId: swap.swapId, partnerId: partner.id, partnerName: partner.name, partnerShiftId: swap.partnerShiftId ?? partner.shiftId ?? "", ownDuty: swap.ownDuty } : null,
      };
      // A swap is one for one, so V cover is counted on the crew's own duties.
      if ((swap?.ownDuty ?? duty) === "V") vOnDuty.set(date, vOnDuty.get(date)! + 1);
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
        for (const ev of birthdayEvents(person.birthday, year, (d) => dutyOn(d).duty, (d) => leaveDates.has(d) || dutyOn(d).swap !== null)) {
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
      // One leave type per person per day; cap at 1 in case older data overlaps.
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

  for (const e of extraDuties) {
    const cell = cells[e.staffId]?.[e.date];
    if (cell) cell.dos = e.kind as DosKind;
  }

  const lockByDate = new Map(locks.map((l) => [l.date, l.remarks]));
  const eventByDate = new Map(events.map((e) => [e.date, { note: e.note }]));

  const ops: RosterData["ops"] = {};
  for (const o of opsDuties) {
    (ops[o.date] ??= []).push({ dayworkerId: o.dayworkerId, username: o.dayworker.username, name: o.dayworker.name, active: o.dayworker.active });
  }
  const extra: RosterData["extra"] = {};
  for (const e of extraShift) {
    (extra[e.date] ??= []).push({ staffId: e.staffId, name: e.staff.name, fromShiftId: e.staff.shiftId ?? "" });
  }
  for (const list of Object.values(ops)) list.sort((a, b) => a.username.localeCompare(b.username));
  for (const list of Object.values(extra)) list.sort((a, b) => a.name.localeCompare(b.name) || a.fromShiftId.localeCompare(b.fromShiftId));

  const days: Record<string, RosterDay> = {};
  for (const date of dates) {
    const shiftDuty = shiftDutyOn(shift.cycleAnchor, date);
    days[date] = {
      date,
      shiftDuty,
      // TODO(open item): Total Strength is the whole shift headcount per spec, including people
      // temporarily on V or post-V Off.
      strength: computeStrength(staff.length, notIn.get(date)!, mflFor(shiftDuty, date)),
      v: shiftDuty === "OFF" ? { onDuty: vOnDuty.get(date)!, mfl: V_MFL } : null,
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
    ops,
    extra,
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
