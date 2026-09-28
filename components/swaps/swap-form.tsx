"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeftRight } from "lucide-react";
import { listSwapCandidates, previewDutySwap, recordSwap, requestSwap } from "@/app/swap-actions";
import { DutyChip } from "@/components/roster/chips";
import { ResultMessage, useAction } from "@/components/roster/use-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatDateShort } from "@/lib/dates";
import { DUTY_LABEL, type Duty } from "@/lib/domain";
import type { SwapCandidateInfo, SwapCheck } from "@/lib/swap-data";
import { cn } from "@/lib/utils";

export type SwapCandidate = { id: string; name: string; shiftId: string };

/**
 * Request a swap for yourself ("request"), or record one between two people as a supervisor or
 * Management ("record"). Pick the date first: the partner list then shows everyone's duty that day
 * and who cannot swap (and why). Shows each date before and after, and the Off(V) knock-on, before
 * submitting.
 */
export function SwapForm({
  mode,
  viewerId,
  firstPeople,
  today,
}: {
  mode: "request" | "record";
  viewerId: string;
  /** Record mode: people the recorder supervises (person 1). */
  firstPeople: SwapCandidate[];
  today: string;
}) {
  const [aId, setAId] = useState(mode === "request" ? viewerId : "");
  const [bId, setBId] = useState("");
  const [date1, setDate1] = useState("");
  const [twoDates, setTwoDates] = useState(false);
  const [date2, setDate2] = useState("");
  const [notes, setNotes] = useState("");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [candidates, setCandidates] = useState<{ aDuties: Duty[]; people: SwapCandidateInfo[] } | null>(null);
  const [preview, setPreview] = useState<SwapCheck | null>(null);
  const [loadingList, startList] = useTransition();
  const [checking, startCheck] = useTransition();
  const { pending, result, run } = useAction();

  // A date typed before the page finished loading is in the box but not yet in state: pick it up.
  const date1Ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const typed = date1Ref.current?.value;
    if (typed) setDate1(typed);
  }, []);

  const dates = useMemo(() => [date1, twoDates ? date2 : ""].filter(Boolean).sort(), [date1, date2, twoDates]);
  const datesReady = Boolean(aId && date1 && (!twoDates || date2));
  const ready = datesReady && Boolean(bId);
  const datesKey = `${aId}|${dates.join(",")}`;

  // Dates (or person 1) changed: reload who is on what, and drop a partner who no longer fits.
  useEffect(() => {
    if (!datesReady) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCandidates(null);
      return;
    }
    let live = true;
    startList(async () => {
      const r = await listSwapCandidates({ aId, dates });
      if (!live) return;
      setCandidates(r);
      setBId((current) => (r.people.some((p) => p.id === current && !p.blocked) ? current : ""));
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datesKey, datesReady]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datesKey, bId, ready]);

  const q = query.trim().toLowerCase();
  const matches = (candidates?.people ?? []).filter((p) => !q || p.name.toLowerCase().includes(q) || `shift ${p.shiftId}`.toLowerCase() === q || p.shiftId.toLowerCase() === q);
  const available = matches.filter((p) => !p.blocked);
  const unavailable = matches.filter((p) => p.blocked);
  const partner = candidates?.people.find((p) => p.id === bId);
  const aPerson = firstPeople.find((p) => p.id === aId);
  const aName = mode === "request" ? "You" : aPerson ? `${aPerson.name} (${aPerson.shiftId})` : "?";
  const bName = partner ? `${partner.name} (${partner.shiftId})` : "?";

  const reset = () => {
    setBId("");
    setDate1("");
    setDate2("");
    setTwoDates(false);
    setNotes("");
    setQuery("");
    setPreview(null);
    setCandidates(null);
  };
  const submit = () => run(() => (mode === "request" ? requestSwap({ partnerId: bId, dates, notes }) : recordSwap({ aId, bId, dates, notes })), reset);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {mode === "request"
          ? "Pick the date, then who to swap with: on that date you work their duty and they work yours. For a give-and-take, add a second date. Supervisors swap with supervisors, and staff with staff. Your partner accepts first, then both shifts' supervisors approve."
          : "Record a swap for someone in your shift (supervisors swap with supervisors, staff with staff). It counts as agreed by both people and approved for your shift; a swap with another shift still needs that shift's supervisor."}
      </p>

      {mode === "record" && (
        <label className="block space-y-1" htmlFor="swap-a">
          <span className="text-xs font-medium">1. Person (your shift)</span>
          <select id="swap-a" value={aId} onChange={(e) => setAId(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
            <option value="">Choose a person</option>
            {firstPeople.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (Shift {p.shiftId})
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="space-y-1.5">
        <span className="text-xs font-medium">{mode === "record" ? "2. " : "1. "}Date</span>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input ref={date1Ref} type="date" aria-label={twoDates ? "First date" : "Date"} value={date1} min={today} onChange={(e) => setDate1(e.target.value)} />
          {twoDates && <Input type="date" aria-label="Second date" value={date2} min={today} onChange={(e) => setDate2(e.target.value)} />}
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={twoDates} onChange={(e) => setTwoDates(e.target.checked)} className="size-4" />
          Add a second date (a give-and-take, or both V nights)
        </label>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-medium">{mode === "record" ? "3. " : "2. "}Swap with</span>
        {!datesReady ? (
          <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
            {mode === "record" && !aId ? "Choose the person first, then the date." : "Pick the date first to see everyone's duty that day."}
          </p>
        ) : !candidates ? (
          <p className="text-xs text-muted-foreground">Loading duties...</p>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              {mode === "request" ? "Your" : `${aPerson?.name}'s`} duty:{" "}
              {candidates.aDuties.map((d, i) => (
                <span key={i} className="mr-1 inline-flex items-center gap-1">
                  {dates.length > 1 && formatDateShort(dates[i])} <DutyChip duty={d} />
                </span>
              ))}
            </p>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a name, or type a shift letter" className="h-8" aria-label="Search people" />
            <ul className={cn("max-h-60 space-y-0.5 overflow-y-auto rounded-md border p-1", loadingList && "opacity-60")} role="radiogroup" aria-label="Swap with">
              {available.map((p) => (
                <CandidateRow key={p.id} person={p} dates={dates} selected={bId === p.id} onSelect={() => setBId(p.id)} />
              ))}
              {available.length === 0 && <li className="px-1 py-1 text-xs text-muted-foreground">Nobody available{q ? " matching your search" : ""} on {dates.length > 1 ? "these dates" : "this date"}.</li>}
              {unavailable.length > 0 && (
                <li>
                  <button type="button" className="w-full px-1 py-1 text-left text-xs text-muted-foreground underline underline-offset-2" onClick={() => setShowAll((v) => !v)}>
                    {showAll ? "Hide" : "Show"} {unavailable.length} who cannot swap
                  </button>
                </li>
              )}
              {showAll && unavailable.map((p) => <CandidateRow key={p.id} person={p} dates={dates} selected={false} onSelect={() => {}} />)}
            </ul>
          </div>
        )}
      </div>

      {ready && checking && !preview && <p className="text-xs text-muted-foreground">Checking...</p>}
      {preview && !preview.ok && <p className="rounded-md bg-red-50 p-2 text-xs font-medium text-red-800 dark:bg-red-500/10 dark:text-red-200">{preview.error}</p>}
      {preview?.ok && (
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
                  {r.staffId === viewerId && mode === "request" ? "You" : preview.names[r.staffId]}, {formatDate(r.date)}: {DUTY_LABEL[r.before]} becomes {DUTY_LABEL[r.after]}
                </p>
              ))}
            </div>
          )}
          {preview.warnings.map((w) => (
            <p key={w} className="rounded-md bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
              {w}
            </p>
          ))}
          <p className="text-[11px] text-muted-foreground">Strength and slots stay the same: each crew loses one person and gains one on that duty. Leave and Tasks do not move.</p>
        </div>
      )}

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

function CandidateRow({ person, dates, selected, onSelect }: { person: SwapCandidateInfo; dates: string[]; selected: boolean; onSelect: () => void }) {
  const blocked = Boolean(person.blocked);
  return (
    <li>
      <label className={cn("flex items-center gap-2 rounded px-1.5 py-1", blocked ? "cursor-not-allowed opacity-55" : "cursor-pointer hover:bg-accent", selected && "bg-primary/10 ring-1 ring-primary")}>
        <input type="radio" name="swap-partner" checked={selected} disabled={blocked} onChange={onSelect} className="size-4" />
        <span className="font-medium">{person.name}</span>
        <span className="text-xs text-muted-foreground">Shift {person.shiftId}</span>
        <span className="ml-auto flex items-center gap-1">
          {person.duties.map((d, i) => (
            <DutyChip key={i} duty={d} className={cn(dates.length > 1 && "px-1")} />
          ))}
          {person.blocked && <span className="text-[11px] text-muted-foreground">{person.blocked}</span>}
        </span>
      </label>
    </li>
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
