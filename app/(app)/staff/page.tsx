import { notFound } from "next/navigation";
import Link from "next/link";
import { StaffManager } from "@/components/staff/staff-manager";
import { requireViewer } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasEditView } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export const metadata = { title: "Staff | PS Tracker" };

const SHIFT_IDS = ["A", "B", "C"];

export default async function StaffPage({ searchParams }: PageProps<"/staff">) {
  const viewer = await requireViewer();
  if (!hasEditView(viewer)) notFound();

  const params = await searchParams;
  const requested = typeof params.shift === "string" ? params.shift : undefined;
  const shiftId = viewer.role === "SUPERVISOR" ? viewer.shiftId! : SHIFT_IDS.includes(requested ?? "") ? requested! : "A";

  const staff = await db.staff.findMany({
    where: { shiftId, role: { not: "MANAGEMENT" } },
    orderBy: [{ active: "desc" }, { role: "desc" }, { name: "asc" }],
  });

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 p-4 pb-24 lg:pb-6">
      <div>
        <h1 className="text-xl font-semibold">Staff</h1>
        <p className="text-sm text-muted-foreground">
          Add, edit, and deactivate staff {viewer.role === "MANAGEMENT" ? "for any shift" : `for Shift ${viewer.shiftId}`}. Deactivating keeps their leave, duty and Task history.
        </p>
      </div>

      {viewer.role === "MANAGEMENT" && (
        <div className="flex w-fit rounded-lg border p-0.5 text-sm" role="tablist" aria-label="Shift">
          {SHIFT_IDS.map((id) => (
            <Link
              key={id}
              href={`/staff?shift=${id}`}
              role="tab"
              aria-selected={shiftId === id}
              className={cn("rounded-md px-3 py-1", shiftId === id ? "bg-secondary font-semibold" : "text-muted-foreground")}
            >
              Shift {id}
            </Link>
          ))}
        </div>
      )}

      <StaffManager
        shiftId={shiftId}
        viewerId={viewer.id}
        canChangeRoleOrShift={viewer.role === "MANAGEMENT"}
        staff={staff.map((s) => ({ id: s.id, name: s.name, role: s.role as "STAFF" | "SUPERVISOR", shiftId: s.shiftId!, birthday: s.birthday, active: s.active }))}
      />
    </main>
  );
}
