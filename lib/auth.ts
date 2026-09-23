import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { Role } from "@/lib/domain";
import type { Viewer } from "@/lib/permissions";

// Demo auth: pick a seeded user on the login screen. The cookie holds a random session token.
const COOKIE = "ps_session";

export async function getViewer(): Promise<Viewer | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { token }, include: { staff: true } });
  if (!session || !session.staff.active) return null;
  const { id, name, role, shiftId } = session.staff;
  return { id, name, role: role as Role, shiftId };
}

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

export async function startSession(staffId: string) {
  const token = randomBytes(24).toString("hex");
  await db.session.create({ data: { token, staffId } });
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/" });
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { token } });
  store.delete(COOKIE);
}
