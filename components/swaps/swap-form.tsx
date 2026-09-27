"use client";
import { useEffect, useState, useTransition } from "react";
import { ArrowLeftRight } from "lucide-react";
import { previewDutySwap, recordSwap, requestSwap } from "@/app/swap-actions";
import { ResultMessage, useAction } from "@/components/roster/use-action";
import { SwapPreview } from "@/components/swaps/swap-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SwapCheck } from "@/lib/swap-data";

export type SwapCandidate = { id: string; name: string; shiftId: string };

function PersonSelect({ id, value, onChange, people, exclude, placeholder }: { id: string; value: string; onChange: (v: string) => void; people: SwapCandidate[]; exclude?: string; placeholder: string }) {
  const shifts = [...new Set(people.map((p) => p.shiftId))].sort();
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
      <option value="">{placeholder}</option>
      {shifts.map((shift) => (
        <optgroup key={shift} label={`Shift ${shift}`}>
          {people
            .filter((p) => p.shiftId === shift && p.id !== exclude)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (Shift {p.shiftId})
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

/**
 * Request a swap for yourself ("request"), or record one between two people as a supervisor or
 * Management ("record"). Shows each date before and after, and the Off(V) knock-on, before submitting.
 */
export function SwapForm({
  mode,
  viewerId,
  firstPeople,
  partners,
  today,
}: {
  mode: "request" | "record";
  viewerId: string;
  /** Record mode: people the recorder supervises (person 1). */
  firstPeople: SwapCandidate[];
  partners: SwapCandidate[];
  today: string;
}) {
  const [aId, setAId] = useState(mode === "request" ? viewerId : "");
  const [bId, setBId] = useState("");
  const [date1, setDate1] = useState("");
  const [twoDates, setTwoDates] = useState(false);
  const [date2, setDate2] = useState("");
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState<SwapCheck | null>(null);
  const [checking, startCheck] = useTransition();
  const { pending, result, run } = useAction();

  const dates = [date1, twoDates ? date2 : ""].filter(Boolean);
  const ready = Boolean(aId && bId && date1 && (!twoDates || date2));
  const key = `${aId}|${bId}|${dates.join(",")}`;

  // Duty swaps are only between different shifts. In "request" mode `partners` is already limited to
  // shifts other than the viewer's own; in "record" mode, filter once person 1 is picked.
  const aShiftId = mode === "record" ? [...firstPeople, ...partners].find((p) => p.id === aId)?.shiftId : undefined;
  const partnerOptions = aShiftId ? partners.filter((p) => p.shiftId !== aShiftId) : partners;

  useEffect(() => {
    if (!ready) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreview(null);
      return;
    }
    let live = true;
    startCheck(async () => {
      const r = await previewDutySwap({ aId, bId, dates });
      if (live) setPreview(r);
    });
    return () => {
      live = false;
    };
    // `key` covers aId, bId and dates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  const nameOf = (id: string) => {
    const p = [...firstPeople, ...partners].find((x) => x.id === id);
    return p ? `${p.name} (${p.shiftId})` : "?";
  };
  const aName = mode === "request" ? "You" : nameOf(aId);
  const bName = nameOf(bId);

  const reset = () => {
    setBId("");
    setDate1("");
    setDate2("");
    setTwoDates(false);
    setNotes("");
    setPreview(null);
  };
  const submit = () => run(() => (mode === "request" ? requestSwap({ partnerId: bId, dates, notes }) : recordSwap({ aId, bId, dates, notes })), reset);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {mode === "request"
          ? "Pick who you want to swap with (a different shift only) and the date. On that date you work their duty and they work yours. For a give-and-take, add a second date: they cover you on one date and you cover them on the other. Your partner accepts first, then both shifts' supervisors approve."
          : "Record a swap between two people on different shifts. It counts as agreed by both people and approved for the shift(s) you supervise; a swap with a shift you don't supervise still needs that shift's supervisor."}
      </p>

      {mode === "record" && (
        <label className="block space-y-1" htmlFor="swap-a">
          <span className="text-xs font-medium">Person 1</span>
          <PersonSelect id="swap-a" value={aId} onChange={setAId} people={firstPeople} placeholder="Choose a person" />
        </label>
      )}
      <label className="block space-y-1" htmlFor="swap-b">
        <span className="text-xs font-medium">{mode === "request" ? "Swap with (a different shift)" : "Person 2 (a different shift from Person 1)"}</span>
        <PersonSelect id="swap-b" value={bId} onChange={setBId} people={partnerOptions} exclude={aId} placeholder="Choose a person" />
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs font-medium">{twoDates ? "First date" : "Date"}</span>
          <Input type="date" value={date1} min={mode === "request" ? today : undefined} onChange={(e) => setDate1(e.target.value)} />
        </label>
        {twoDates && (
          <label className="block space-y-1">
            <span className="text-xs font-medium">Second date</span>
            <Input type="date" value={date2} min={mode === "request" ? today : undefined} onChange={(e) => setDate2(e.target.value)} />
          </label>
        )}
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={twoDates} onChange={(e) => setTwoDates(e.target.checked)} className="size-4" />
        Add a second date (a give-and-take, or both V nights)
      </label>

      {ready && checking && !preview && <p className="text-xs text-muted-foreground">Checking...</p>}
      {preview && <SwapPreview preview={preview} aName={aName} bName={bName} viewerId={viewerId} asYou={mode === "request"} />}

      <label className="block space-y-1">
        <span className="text-xs font-medium">Notes {mode === "request" ? "for your partner and supervisors" : ""}</span>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} placeholder="Optional" />
      </label>
      <Button className="w-full" disabled={pending || checking || !preview?.ok} onClick={submit}>
        <ArrowLeftRight className="size-4" />
        {pending ? "Sending..." : mode === "request" ? "Send swap request" : "Record swap"}
      </Button>
      <ResultMessage result={result} />
    </div>
  );
}
