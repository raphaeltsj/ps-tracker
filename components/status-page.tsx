import Link from "next/link";

/** A calm full-page message (not found, no access, something went wrong) with a way back. */
export function StatusPage({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-lg font-semibold">{title}</h1>
      <div className="text-sm text-muted-foreground">{children}</div>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {action}
        <Link href="/home" className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-accent">
          Go to Home
        </Link>
        <Link href="/roster" className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-accent">
          Open the roster
        </Link>
      </div>
    </main>
  );
}
