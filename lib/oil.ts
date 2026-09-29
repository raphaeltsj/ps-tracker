import "server-only";
import { db } from "@/lib/db";
import { baseLeaveCode } from "@/lib/domain";
import type { OilBalance } from "@/lib/leave-report";

export type { OilBalance };

/**
 * OIL (off in lieu) someone can take: `allowed` is what supervisors / Management have awarded (the sum
 * of OilGrant rows), `used` is their approved OIL leave (half-day counts 0.5). It is a running balance,
 * not reset each year. The 0.5 OIL that comes with a DOS/FDO duty (Leave.autoFor) is earned and taken
 * at once, so it counts on neither side.
 */

export async function getOilBalances(staffIds: string[]): Promise<Record<string, OilBalance>> {
  if (staffIds.length === 0) return {};
  const [grants, oilTypes] = await Promise.all([
    db.oilGrant.groupBy({ by: ["staffId"], where: { staffId: { in: staffIds } }, _sum: { amount: true } }),
    db.leaveType.findMany({ select: { code: true, halfDay: true } }).then((types) => types.filter((t) => baseLeaveCode(t.code) === "OIL")),
  ]);
  const leaves = oilTypes.length
    ? await db.leave.findMany({
        where: { staffId: { in: staffIds }, status: "APPROVED", autoFor: null, typeCode: { in: oilTypes.map((t) => t.code) } },
        select: { staffId: true, typeCode: true, _count: { select: { days: true } } },
      })
    : [];
  const halfDay = new Map(oilTypes.map((t) => [t.code, t.halfDay]));

  const out: Record<string, OilBalance> = {};
  for (const id of staffIds) out[id] = { allowed: 0, used: 0, left: 0 };
  for (const g of grants) out[g.staffId].allowed = g._sum.amount ?? 0;
  for (const l of leaves) out[l.staffId].used += l._count.days * (halfDay.get(l.typeCode) ? 0.5 : 1);
  for (const b of Object.values(out)) b.left = b.allowed - b.used;
  return out;
}
