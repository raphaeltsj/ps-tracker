// Seeds 3 shifts, placeholder staff, demo users, duties, leave, Tasks, locks and events around the
// current month so the app looks populated on first run. Re-running wipes and reseeds.
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../lib/generated/prisma/client";
import { DATABASE_URL } from "../lib/db-url";
import { cyclePosition, dosEarnsOil, shiftDutyOn } from "../lib/cycle";
import { addDays, dateRange, dayIndex, monthDates, shiftMonth, todayLocal } from "../lib/dates";
import { COMMON_LEAVE_TYPES, DOS_KINDS, DOS_OIL_CODE, DOS_OIL_HALF } from "../lib/domain";

const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: DATABASE_URL }) });

// Deterministic randomness so every teammate gets the same demo data.
let rngState = 20260922;
function rand() {
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

// Placeholder names: single 5-character words (spec 14.6). Names may repeat across shifts.
const NAMES = [
  "Alpha", "Bravo", "Delta", "Eagle", "Frost", "Grace", "Haven", "Ivory", "Jolly", "Karma",
  "Lemon", "Maple", "Noble", "Olive", "Pearl", "Quill", "Raven", "Sunny", "Tiger", "Ultra",
  "Vivid", "Witty", "Xenon", "Yacht", "Zebra", "Amber", "Blaze", "Cedar", "Daisy", "Ember",
  "Flint", "Hazel", "Jewel", "Koala", "Lotus", "Mango", "Orbit", "Pixel", "Quest", "River",
];

// Shift A starts PM Day 1 on 2026-01-01; B and C are offset so handover runs A -> B -> C -> A.
const DAY1 = dayIndex("2026-01-01");
const SHIFTS = [
  { id: "A", name: "Shift A", cycleAnchor: DAY1, size: 26, nameOffset: 0 },
  { id: "B", name: "Shift B", cycleAnchor: DAY1 - 4, size: 24, nameOffset: 12 },
  { id: "C", name: "Shift C", cycleAnchor: DAY1 - 2, size: 22, nameOffset: 24 },
];

async function main() {
  // Wipe in dependency order.
  await db.session.deleteMany();
  await db.oilGrant.deleteMany();
  await db.dutySwap.deleteMany(); // days cascade
  await db.announcementDismissal.deleteMany();
  await db.announcement.deleteMany();
  await db.staffTaskProficiency.deleteMany();
  await db.taskAssignment.deleteMany();
  await db.task.deleteMany();
  await db.leaveDay.deleteMany();
  await db.leave.deleteMany();
  await db.leaveType.deleteMany();
  await db.dutyOverride.deleteMany();
  await db.extraDuty.deleteMany();
  await db.extraShiftDuty.deleteMany();
  await db.opsDuty.deleteMany();
  await db.dayworker.deleteMany();
  await db.lockedDate.deleteMany();
  await db.specialEvent.deleteMany();
  await db.staff.deleteMany();
  await db.shift.deleteMany();

  await db.leaveType.createMany({
    data: COMMON_LEAVE_TYPES.map((t, i) => ({ code: t.code, name: t.name, halfDay: t.halfDay ?? false, sortOrder: i })),
  });

  const tasks = [];
  // Names are at most 6 characters: "Task 10" would be 7, so from the tenth on they are "T10", "T11"...
  for (let i = 1; i <= 12; i++) tasks.push(await db.task.create({ data: { name: i < 10 ? `Task ${i}` : `T${i}` } }));

  // Dayworkers: office staff who clock shift duty as Ops duty. One username uses the full 7 characters,
  // and one is inactive, so both show in the demo.
  const dayworkers = [];
  for (const [name, username, active] of [
    ["Comet", "CMT", true],
    ["Sable", "SBL", true],
    ["Torch", "TRCH", true],
    ["Ridge", "RDG", true],
    ["Glint", "GLINT07", false],
  ] as const) {
    dayworkers.push(await db.dayworker.create({ data: { name, username, active } }));
  }
  const activeDayworkers = dayworkers.filter((d) => d.active);

  const thisMonth = todayLocal().slice(0, 7);
  const from = `${shiftMonth(thisMonth, -1)}-01`;
  const to = monthDates(shiftMonth(thisMonth, 1)).at(-1)!;
  const range = dateRange(from, to);
  const monthDays = monthDates(thisMonth);

  await db.staff.createMany({
    data: [
      { name: "Crown", role: "MANAGEMENT", shiftId: null },
      { name: "Pilot", role: "MANAGEMENT", shiftId: null },
    ],
  });

  const membersByShift: Record<string, { id: string }[]> = {};
  for (const s of SHIFTS) {
    await db.shift.create({ data: { id: s.id, name: s.name, cycleAnchor: s.cycleAnchor } });
    const members = [];
    for (let i = 0; i < s.size; i++) {
      const name = NAMES[(s.nameOffset + i) % NAMES.length];
      const month = String(1 + Math.floor(rand() * 12)).padStart(2, "0");
      const day = String(1 + Math.floor(rand() * 28)).padStart(2, "0");
      members.push(
        await db.staff.create({
          data: { name, role: i === 0 ? "SUPERVISOR" : "STAFF", shiftId: s.id, birthday: `1990-${month}-${day}` },
        }),
      );
    }

    membersByShift[s.id] = members;

    // A birthday on an Off day this month, so BD shows as a marker and BD-IL moves to the next working day.
    const offDay = monthDays.find((d) => d.slice(8) >= "05" && shiftDutyOn(s.cycleAnchor, d) === "OFF" && cyclePosition(s.cycleAnchor, d) === 4)!;
    await db.staff.update({ where: { id: members[3].id }, data: { birthday: `1991${offDay.slice(4)}` } });

    // V duty: on every Off block one person works V on both days, with one V(SB) standing by for both.
    const overrides: { staffId: string; date: string; duty: string }[] = [];
    let vTurn = 2;
    for (const date of range) {
      if (cyclePosition(s.cycleAnchor, date) !== 4) continue;
      const next = addDays(date, 1);
      const v = members[vTurn % s.size];
      const sb = members[(vTurn + 5) % s.size];
      overrides.push({ staffId: v.id, date, duty: "V" }, { staffId: v.id, date: next, duty: "V" });
      overrides.push({ staffId: sb.id, date, duty: "VSB" }, { staffId: sb.id, date: next, duty: "VSB" });
      vTurn += 3;
    }
    // An activated V(SB) gets an Off(V) on a day the supervisor picks (an assigned Off is an Off(V)).
    const sbActivated = overrides.find((o) => o.duty === "VSB" && o.date > todayLocal());
    if (sbActivated) {
      const offDate = range.find((d) => d > addDays(sbActivated.date, 2) && shiftDutyOn(s.cycleAnchor, d) !== "OFF");
      if (offDate) overrides.push({ staffId: sbActivated.staffId, date: offDate, duty: "OFF" });
    }
    await db.dutyOverride.createMany({ data: overrides });
    for (const o of overrides) if (o.duty === "V" || o.duty === "VSB") markDutyDay(o.staffId, o.date);

    const sup = members[0];
    const staff = members.slice(1);

    // DOS / DOS2IC / FDO: one-day 24-hour duties on AM days, each with its automatic 0.5 OIL.
    const amDays = monthDays.filter((d) => shiftDutyOn(s.cycleAnchor, d) === "AM");
    const onV = new Set(overrides.map((o) => o.staffId + "|" + o.date));
    let dosTurn = 0;
    for (const date of amDays.slice(0, 6)) {
      const who = members[(dosTurn * 5 + 4) % s.size];
      if (onV.has(who.id + "|" + date) || onV.has(who.id + "|" + addDays(date, 1))) continue;
      const kind = DOS_KINDS[dosTurn % DOS_KINDS.length];
      const duty = await db.extraDuty.create({ data: { staffId: who.id, date, kind } });
      markDutyDay(who.id, date);
      // Only a 1st AM duty earns the next-day 0.5 OIL: after a 2nd AM the person is already Off.
      if (dosEarnsOil(s.cycleAnchor, date)) {
        await createLeave(who.id, DOS_OIL_CODE, [addDays(date, 1)], "APPROVED", {
          half: DOS_OIL_HALF,
          remarks: "Automatic after " + kind + " duty on " + date + ".",
          givenById: sup.id,
          autoFor: duty.id,
        });
      }
      dosTurn++;
    }

    // Approved leave: short blocks spread across the range.
    const fullTypes = ["AL", "AL", "AL", "OL", "MC", "FCL", "CSE", "MWO", "OML", "1 OIL"];
    for (let i = 0; i < 38; i++) {
      const who = pick(staff.slice(1));
      const start = pick(range);
      const len = 1 + Math.floor(rand() * 3);
      await createLeave(who.id, pick(fullTypes), dateRange(start, addDays(start, len - 1)), "APPROVED", {
        givenById: rand() < 0.3 ? sup.id : null,
        remarks: rand() < 0.3 ? "Given by supervisor" : null,
      });
    }
    // Half-day leave.
    for (let i = 0; i < 10; i++) {
      await createLeave(pick(staff.slice(1)).id, pick(["0.5 AL", "0.5 OIL"]), [pick(range)], "APPROVED", {
        half: rand() < 0.5 ? "FIRST" : "SECOND",
      });
    }

    // Slots at zero on one weekday PM (shift A) and below MFL on one (shift B).
    const pmWeekdays = monthDays.filter((d) => shiftDutyOn(s.cycleAnchor, d) === "PM" && ![0, 6].includes(new Date(d).getUTCDay()));
    if (s.id !== "C" && pmWeekdays.length > 1) {
      const target = pmWeekdays[1];
      const extra = s.id === "A" ? 26 - 12 : 24 - 12 + 1; // Total - MFL (+1 to go below)
      const already = new Set(
        (await db.leaveDay.findMany({ where: { date: target, leave: { status: "APPROVED", staff: { shiftId: s.id } } }, include: { leave: true } })).map((d) => d.leave.staffId),
      );
      const available = staff.filter((m) => !already.has(m.id));
      for (const m of available.slice(0, Math.max(0, extra - already.size))) {
        await createLeave(m.id, "AL", [target], "APPROVED");
      }
    }

    // Requests from staff: pending, rejected, withdrawn.
    const demo = staff[0]; // the demo staff login for this shift
    const future = range.filter((d) => d > todayLocal());
    await createLeave(demo.id, "AL", dateRange(future[6], future[7]), "PENDING", { notes: "Family trip, flexible on dates." });
    await createLeave(demo.id, "0.5 OIL", [future[12]], "PENDING", { half: "SECOND", notes: "Appointment in the evening." });
    await createLeave(demo.id, "OL", dateRange(future[20], future[23]), "REJECTED", { rejectReason: "Clashes with the training week." });
    await createLeave(demo.id, "AL", [future[3]], "WITHDRAWN");
    await createLeave(demo.id, "AL", [future[1]], "APPROVED", { notes: "Moving house." });
    for (let i = 0; i < 4; i++) {
      await createLeave(pick(staff.slice(1)).id, pick(["AL", "FCL", "OL"]), [pick(future.slice(0, 30))], "PENDING", {
        notes: pick(["Wedding of a friend.", "Child's school event.", "Personal matters.", null]),
      });
    }
    await createLeave(sup.id, "AL", [future[9]], "PENDING", { notes: "Own request, to approve from Staff view." });

    // Tasks on working days: several people share a Task; some people have none.
    const fullLeave = new Set(
      (await db.leaveDay.findMany({ where: { leave: { status: "APPROVED", staffId: { in: members.map((m) => m.id) }, type: { halfDay: false } } }, include: { leave: true } })).map(
        (d) => `${d.leave.staffId}|${d.date}`,
      ),
    );
    // Days a person is not on their normal cycle duty: V days themselves and the post-V Off PM block.
    const vDays = overrides.filter((o) => o.duty === "V");
    const postV = new Set(
      vDays.flatMap((o) => {
        const toPm = 6 - cyclePosition(s.cycleAnchor, o.date); // next PM Day 1
        return [toPm, toPm + 1].map((n) => `${o.staffId}|${addDays(o.date, n)}`);
      }),
    );
    const assignments: { taskId: string; staffId: string; date: string }[] = [];
    for (const date of range) {
      if (shiftDutyOn(s.cycleAnchor, date) === "OFF") continue;
      for (const m of staff.slice(0, 10)) {
        const key = `${m.id}|${date}`;
        if (rand() < 0.35 || fullLeave.has(key) || postV.has(key)) continue;
        assignments.push({ taskId: pick(tasks).id, staffId: m.id, date });
      }
    }
    // People on V duty can hold a Task too.
    for (const v of vDays) {
      if (rand() < 0.7 && !fullLeave.has(`${v.staffId}|${v.date}`)) assignments.push({ taskId: pick(tasks).id, staffId: v.staffId, date: v.date });
    }
    await db.taskAssignment.createMany({ data: assignments });

    // Task proficiency: who is trained for which Task, kept by supervisors only (never shown to
    // staff, never affects the roster). Most people are proficient in a handful, understudying a couple.
    const proficiencyRows: { staffId: string; taskId: string; understudy: boolean }[] = [];
    for (const m of members) {
      for (const t of tasks) {
        const r = rand();
        if (r < 0.35) proficiencyRows.push({ staffId: m.id, taskId: t.id, understudy: false });
        else if (r < 0.45) proficiencyRows.push({ staffId: m.id, taskId: t.id, understudy: true });
      }
    }
    await db.staffTaskProficiency.createMany({ data: proficiencyRows });

    // Locked date, special event and a raised V headcount this month. Pick future dates where possible
    // so the banner that comes with them (below) actually shows up live in the demo.
    const working = monthDays.filter((d) => shiftDutyOn(s.cycleAnchor, d) !== "OFF");
    const workingFuture = working.filter((d) => d > todayLocal());
    const lockDate = workingFuture[Math.min(3, workingFuture.length - 1)] ?? working[Math.min(8, working.length - 1)];
    const eventDate = workingFuture[Math.min(7, workingFuture.length - 1)] ?? working[Math.min(12, working.length - 1)];
    await db.lockedDate.create({ data: { shiftId: s.id, date: lockDate, remarks: "Important meeting: all hands on deck." } });
    await db.specialEvent.create({ data: { shiftId: s.id, date: eventDate, note: "Ceremony: the whole shift attends." } });
    // The optional banner a supervisor can add alongside a lock or event (spec 8.4).
    await db.announcement.create({
      data: { shiftId: s.id, message: `Locked ${lockDate}: important meeting, all hands on deck.`, showFrom: todayLocal(), activeUntil: lockDate, createdById: sup.id },
    });
    // V MFL is always 1, so there is no per-date V headcount to seed.
  }

  // A Management-wide announcement, so every viewer sees it combined with their own shift's banner
  // above into one (spec 8.4: several announcements combine into one banner).
  const management = await db.staff.findFirst({ where: { role: "MANAGEMENT" } });
  if (management) {
    await db.announcement.create({
      data: { shiftId: null, message: "Reminder: submit training records by month end.", showFrom: todayLocal(), activeUntil: addDays(todayLocal(), 21), createdById: management.id },
    });
  }

  // Ops duty: dayworkers clocking shift duty on AM and PM days. Some days have two dayworkers and some
  // none, so stacked cells show. A dayworker clocks one shift per day. Past days may use the inactive one.
  const today = todayLocal();
  const opsRows: { dayworkerId: string; shiftId: string; date: string }[] = [];
  const clocked = new Set<string>();
  let opsTurn = 0;
  for (const date of range) {
    const pool = date <= today ? dayworkers : activeDayworkers;
    for (const s of SHIFTS) {
      if (shiftDutyOn(s.cycleAnchor, date) === "OFF") continue;
      const n = rand() < 0.2 ? 0 : rand() < 0.35 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const dw = pool[opsTurn++ % pool.length];
        if (clocked.has(dw.id + "|" + date)) continue;
        clocked.add(dw.id + "|" + date);
        opsRows.push({ dayworkerId: dw.id, shiftId: s.id, date });
      }
    }
  }
  await db.opsDuty.createMany({ data: opsRows });

  // Extra duty: people serving extra shifts on another shift's days, never on a day they have leave.
  const extraRows: { staffId: string; hostShiftId: string; date: string }[] = [];
  const serving = new Set<string>();
  for (const host of SHIFTS) {
    const others = SHIFTS.filter((x) => x.id !== host.id).flatMap((x) => membersByShift[x.id].slice(1));
    let added = 0;
    for (const date of monthDays) {
      if (added >= 6 || rand() < 0.7) continue;
      for (let c = rand() < 0.3 ? 2 : 1; c > 0; c--) {
        const person = pick(others);
        if (serving.has(person.id + "|" + date) || activeLeaveDays.get(person.id)?.has(date)) continue;
        serving.add(person.id + "|" + date);
        extraRows.push({ staffId: person.id, hostShiftId: host.id, date });
        added++;
      }
    }
  }
  await db.extraShiftDuty.createMany({ data: extraRows });

  // Festive lock on every shift.
  const year = thisMonth.slice(0, 4);
  for (const s of SHIFTS) {
    for (const date of [`${year}-12-24`, `${year}-12-25`]) {
      await db.lockedDate.create({ data: { shiftId: s.id, date, remarks: "Festive period (Christmas). Balloting handled outside the app." } });
    }
  }

  // OIL each person may take, awarded by their supervisor: enough to cover the OIL leave already
  // approved above, plus a different amount left for each person. Last, so it doesn't change the
  // random sequence (and so the demo data) above.
  const oilCodes = COMMON_LEAVE_TYPES.filter((t) => t.code.endsWith(" OIL"));
  for (const s of SHIFTS) {
    const people = await db.staff.findMany({ where: { shiftId: s.id, role: { not: "MANAGEMENT" } }, select: { id: true, role: true } });
    const supervisorId = people.find((p) => p.role === "SUPERVISOR")?.id ?? null;
    const oilLeave = await db.leave.findMany({
      where: { staffId: { in: people.map((p) => p.id) }, status: "APPROVED", autoFor: null, typeCode: { in: oilCodes.map((t) => t.code) } },
      select: { staffId: true, typeCode: true, _count: { select: { days: true } } },
    });
    const used = new Map<string, number>();
    for (const l of oilLeave) used.set(l.staffId, (used.get(l.staffId) ?? 0) + l._count.days * (oilCodes.find((t) => t.code === l.typeCode)?.halfDay ? 0.5 : 1));
    const grants = people.flatMap((p) => {
      const amount = (used.get(p.id) ?? 0) + pick([0, 0.5, 1, 1, 1.5, 2, 3]);
      return amount > 0 ? [{ staffId: p.id, amount, byId: supervisorId }] : [];
    });
    await db.oilGrant.createMany({ data: grants });
  }

  console.log("Seeded shifts A, B, C with demo staff, leave, duties and Tasks.");
}

// Only one type of leave per person per day: skip any active leave that would overlap.
const activeLeaveDays = new Map<string, Set<string>>();
// No leave on a V, V(SB) or DOS/FDO day (spec 5.1, 12.3): skip leave that would land on one.
const dutyDays = new Map<string, Set<string>>();
function markDutyDay(staffId: string, date: string) {
  dutyDays.set(staffId, (dutyDays.get(staffId) ?? new Set<string>()).add(date));
}

async function createLeave(
  staffId: string,
  typeCode: string,
  dates: string[],
  status: string,
  extra: { half?: string; notes?: string | null; remarks?: string | null; rejectReason?: string; givenById?: string | null; autoFor?: string } = {},
) {
  if (status === "APPROVED" || status === "PENDING") {
    const taken = activeLeaveDays.get(staffId) ?? new Set<string>();
    if (dates.some((d) => taken.has(d) || dutyDays.get(staffId)?.has(d))) return;
    dates.forEach((d) => taken.add(d));
    activeLeaveDays.set(staffId, taken);
  }
  const decided = status === "APPROVED" || status === "REJECTED";
  await db.leave.create({
    data: {
      staffId,
      typeCode,
      status,
      half: extra.half ?? null,
      notes: extra.notes ?? null,
      remarks: extra.remarks ?? null,
      rejectReason: extra.rejectReason ?? null,
      givenById: extra.givenById ?? null,
      autoFor: extra.autoFor ?? null,
      decidedAt: decided ? new Date() : null,
      submittedAt: new Date(Date.now() - Math.floor(rand() * 10 * 86_400_000)),
      days: { create: [...new Set(dates)].map((date) => ({ date })) },
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
