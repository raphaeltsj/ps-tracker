// Dayworkers (spec 5.3): office staff who are not part of a shift crew but clock shift duty as Ops duty.
export const DAYWORKER_USERNAME_MAX = 7;
export const DAYWORKER_NAME_MAX = 40;

export type UsernameResult = { ok: true; username: string } | { ok: false; error: string };

/**
 * The username is what the roster shows, so it is short and shown in capitals, like "TYL".
 * Stored upper case so two usernames that differ only by case cannot both exist.
 */
export function normalizeUsername(input: unknown): UsernameResult {
  if (typeof input !== "string") return { ok: false, error: "Enter a username." };
  const username = input.trim();
  if (username.length === 0) return { ok: false, error: "Enter a username." };
  if (/\s/.test(username)) return { ok: false, error: "A username cannot contain spaces." };
  if (username.length > DAYWORKER_USERNAME_MAX) {
    return { ok: false, error: `A username is at most ${DAYWORKER_USERNAME_MAX} characters.` };
  }
  return { ok: true, username: username.toUpperCase() };
}

export function normalizeDayworkerName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const name = input.replace(/\s+/g, " ").trim();
  return name.length > 0 && name.length <= DAYWORKER_NAME_MAX ? name : null;
}

/** One dayworker in the duty report: how many days they clocked Ops duty, and where (spec 5.3). */
export type DayworkerReportRow = {
  id: string;
  name: string;
  username: string;
  active: boolean;
  total: number;
  byShift: Record<string, number>;
  days: { date: string; shiftId: string }[];
};
