// What a proposed swap changes: shared between the dropdown SwapForm and the roster's cell-picking
// swap tool, so both show the same before/after table and Off(V) knock-on notes.
import { DutyChip } from "@/components/roster/chips";
import { formatDate, formatDateShort } from "@/lib/dates";
import { DUTY_LABEL, type Duty } from "@/lib/domain";
import type { SwapCheck } from "@/lib/swap-data";

export function SwapPreview({ preview, aName, bName, viewerId, asYou }: { preview: SwapCheck; aName: string; bName: string; viewerId: string; asYou: boolean }) {
  if (!preview.ok) return <p className="rounded-md bg-red-50 p-2 text-xs font-medium text-red-800 dark:bg-red-500/10 dark:text-red-200">{preview.error}</p>;
  return (
    <div className="space-y-2 rounded-md border p-2">
      <p className="text-xs font-medium text-muted-foreground">What changes</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-1 font-medium">Date</th>
            <th className="py-1 font-medium">{aName}</th>
            <th className="py-1 font-medium">{bName}</th>
          </tr>
        </thead>
        <tbody>
          {preview.rows.map((r) => (
            <tr key={r.date} className="border-t">
              <td className="py-1.5 pr-2">{formatDateShort(r.date)}</td>
              <td className="py-1.5 pr-2">
                <BeforeAfter before={r.aBefore} after={r.aAfter} />
              </td>
              <td className="py-1.5">
                <BeforeAfter before={r.bBefore} after={r.bAfter} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {preview.ripples.length > 0 && (
        <div className="space-y-0.5 text-xs">
          <p className="font-medium text-muted-foreground">Also part of this swap (the Off(V) moves with the V):</p>
          {preview.ripples.map((r) => (
            <p key={`${r.staffId}-${r.date}`}>
              {r.staffId === viewerId && asYou ? "You" : preview.names[r.staffId]}, {formatDate(r.date)}: {DUTY_LABEL[r.before]} becomes {DUTY_LABEL[r.after]}
            </p>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">Strength and slots stay the same: each crew loses one person and gains one on that duty. Leave and Tasks do not move.</p>
    </div>
  );
}

function BeforeAfter({ before, after }: { before: Duty; after: Duty }) {
  return (
    <span className="inline-flex items-center gap-1">
      <DutyChip duty={before} className="opacity-60" />
      <span aria-label="becomes">→</span>
      <DutyChip duty={after} />
    </span>
  );
}
