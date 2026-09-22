// Birthday leave (spec 12.1): BD on the birthday; if that is an Off day, BD is a marker only and
// BD-IL goes on the next working day.
// TODO(open item): whether BD / BD-IL are automatic or requested, whether they need a slot, whether
// BD-IL can be moved, and whether BD-IL counts in Not in Strength. For now they are derived
// automatically from the staff record and count like any full-day leave.
import { addDays } from "@/lib/dates";
import { isWorkingDuty, type Duty } from "@/lib/domain";

export type BirthdayEvent = { date: string; code: "BD" | "BD-IL"; counts: boolean };

function birthdayIn(birthday: string, year: number): string {
  const [, m, d] = birthday.split("-");
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const day = m === "02" && d === "29" && !leap ? "28" : d;
  return `${year}-${m}-${day}`;
}

export function birthdayEvents(birthday: string, year: number, dutyOn: (date: string) => Duty): BirthdayEvent[] {
  const date = birthdayIn(birthday, year);
  if (isWorkingDuty(dutyOn(date))) return [{ date, code: "BD", counts: true }];

  const events: BirthdayEvent[] = [{ date, code: "BD", counts: false }];
  for (let i = 1; i <= 14; i++) {
    const next = addDays(date, i);
    if (isWorkingDuty(dutyOn(next))) {
      events.push({ date: next, code: "BD-IL", counts: true });
      break;
    }
  }
  return events;
}
