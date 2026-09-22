import { login } from "@/app/actions";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { db } from "@/lib/db";
import { ROLE_LABEL, type Role } from "@/lib/domain";

export const metadata = { title: "Sign in | PS Tracker" };

// Demo login: choose a seeded user. No passwords in this demo build.
export default async function LoginPage() {
  const staff = await db.staff.findMany({
    where: { active: true },
    orderBy: [{ shiftId: "asc" }, { role: "desc" }, { name: "asc" }],
    include: { _count: { select: { leaves: { where: { status: { not: "APPROVED" } } } } } },
  });
  const management = staff.filter((s) => s.role === "MANAGEMENT");
  const shifts = ["A", "B", "C"].map((id) => {
    const members = staff.filter((s) => s.shiftId === id && s.role === "STAFF");
    // Feature the staff member with the most request history, so the demo shows every status.
    const featured = [...members].sort((a, b) => b._count.leaves - a._count.leaves)[0];
    return {
      id,
      supervisor: staff.find((s) => s.shiftId === id && s.role === "SUPERVISOR"),
      members: featured ? [featured, ...members.filter((m) => m.id !== featured.id)] : members,
    };
  });

  const UserButton = ({ id, name, role, hint }: { id: string; name: string; role: Role; hint?: string }) => (
    <form action={login}>
      <input type="hidden" name="staffId" value={id} />
      <button
        type="submit"
        className="flex w-full items-center justify-between rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent"
      >
        <span>
          <span className="block font-medium">{name}</span>
          <span className="block text-xs text-muted-foreground">{hint ?? ROLE_LABEL[role]}</span>
        </span>
        <span className="text-xs text-muted-foreground">Sign in</span>
      </button>
    </form>
  );

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <Logo />
        <ThemeToggle />
      </div>
      <h1 className="text-2xl font-semibold">Choose a demo user</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Demo build: pick anyone to sign in as them. Names are placeholders.
      </p>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Management</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {management.map((m) => (
            <UserButton key={m.id} id={m.id} name={m.name} role="MANAGEMENT" hint="Management, all shifts" />
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {shifts.map((s) => (
          <section key={s.id}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Shift {s.id}</h2>
            <div className="grid gap-2">
              {s.supervisor && <UserButton id={s.supervisor.id} name={s.supervisor.name} role="SUPERVISOR" hint={`Supervisor, Shift ${s.id}`} />}
              {s.members[0] && <UserButton id={s.members[0].id} name={s.members[0].name} role="STAFF" hint={`Regular Staff, Shift ${s.id}`} />}
              <details className="rounded-lg border px-3 py-2 text-sm">
                <summary className="cursor-pointer text-muted-foreground">All {s.members.length} staff</summary>
                <div className="mt-2 grid gap-1.5">
                  {s.members.slice(1).map((m) => (
                    <form key={m.id} action={login}>
                      <input type="hidden" name="staffId" value={m.id} />
                      <button type="submit" className="w-full rounded px-2 py-1 text-left hover:bg-accent">
                        {m.name}
                      </button>
                    </form>
                  ))}
                </div>
              </details>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
