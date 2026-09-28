export const STAFF_NAME_MAX = 40;

export function normalizeStaffName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const name = input.replace(/\s+/g, " ").trim();
  return name.length > 0 && name.length <= STAFF_NAME_MAX ? name : null;
}

export type StaffRole = "STAFF" | "SUPERVISOR";

export function isStaffRole(value: unknown): value is StaffRole {
  return value === "STAFF" || value === "SUPERVISOR";
}
