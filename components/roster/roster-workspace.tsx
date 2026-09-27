"use client";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, ChevronUp, Eye, Pencil } from "lucide-react";
import { CalendarView } from "@/components/roster/calendar-view";
import { MobileRoster } from "@/components/roster/mobile-roster";
import { RosterGrid } from "@/components/roster/roster-grid";
import { SidePanel } from "@/components/roster/side-panel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { dateRange, dayIndex, formatMonth, shiftMonth } from "@/lib/dates";
import type { Viewer } from "@/lib/permissions";
import { isPseudoRow, type DayworkerOption, type ExtraCandidate, type LeaveSummary, type LeaveTypeOption, type RosterData, type TaskOption } from "@/lib/roster-types";
import { cn } from "@/lib/utils";

export type WorkspaceProps = {
  viewer: Viewer;
  roster: RosterData;
  month: string;
  view: "roster" | "calendar";
  mode: "staff" | "edit";
  today: string;
  leaveTypes: LeaveTypeOption[];
  tasks: TaskOption[];
  /** Active dayworkers and people from other shifts, loaded for editors only (Ops and Extra rows) */
  dayworkers: DayworkerOption[];
  extraCandidates: ExtraCandidate[];
  myLeaves: LeaveSummary[];
  /** Edit view on a shift the viewer may edit */
  canEdit: boolean;
  /** Staff view on the viewer's own shift */
  canRequest: boolean;
  canRequestLocked: boolean;
  hasEditView: boolean;
};

const DESKTOP_QUERY = "(min-width: 1024px)";

/** Render the panel once: right-hand panel on desktop, bottom sheet on mobile. */
function useIsDesktop() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(DESKTOP_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}

export const cellKey = (staffId: string, date: string) => `${staffId}|${date}`;

export type Selection = {
  dates: Set<string>; // Staff view: dates for a leave request
  cells: Set<string>; // Edit view: staffId|date
  focusDate: string | null;
  // True when focusDate came from clicking a date (header, calendar cell, mobile week strip), not a
  // person's cell: editors then see that date's lock and special-event settings instead of the normal
  // duty / Task / leave tools (spec 8.1).
  dateSettingsOpen: boolean;
  focusLeaveId: string | null;
};

export function RosterWorkspace(props: WorkspaceProps) {
  const { roster, month, view, mode, canEdit, canRequest, canRequestLocked, today } = props;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [dates, setDates] = useState<Set<string>>(new Set());
  const [cells, setCells] = useState<Set<string>>(new Set());
  const [focusDate, setFocusDate] = useState<string | null>(roster.dates.includes(today) ? today : null);
  const [dateSettingsOpen, setDateSettingsOpen] = useState(false);
  const [focusLeaveId, setFocusLeaveId] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<{ staffId: string | null; date: string } | null>(null);
  const [compact, setCompact] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    try {
      // Per-viewer convenience only.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCompact(localStorage.getItem("ps-compact") === "1");
    } catch {}
  }, []);
  const toggleCompact = (v: boolean) => {
    setCompact(v);
    try {
      localStorage.setItem("ps-compact", v ? "1" : "0");
    } catch {}
  };

  const navigate = useCallback(
    (changes: Record<string, string>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(changes)) next.set(k, v);
      router.push(`${pathname}?${next.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const selectable = useCallback(
    (date: string) => canRequestLocked || !roster.days[date]?.locked,
    [canRequestLocked, roster.days],
  );

  /**
   * Date header, calendar cell, or mobile week strip: show that date's details. For editors this
   * replaces the normal duty / Task / leave tools with the date's lock and special-event settings.
   * Clicking the same date again (or the panel's close button, via closeDateSettings) goes back.
   */
  const focusDateOnly = useCallback(
    (date: string) => {
      if (focusDate === date && dateSettingsOpen) {
        setFocusDate(null);
        setDateSettingsOpen(false);
        return;
      }
      setFocusDate(date);
      setDateSettingsOpen(true);
      setFocusLeaveId(null);
      setSheetOpen(true);
    },
    [focusDate, dateSettingsOpen],
  );

  const closeDateSettings = useCallback(() => {
    setFocusDate(null);
    setDateSettingsOpen(false);
  }, []);

  /** Staff view: pick dates for a request (click toggles, shift-click selects a range). */
  const clickDate = useCallback(
    (date: string, shiftKey: boolean) => {
      setFocusDate(date);
      setDateSettingsOpen(true);
      setFocusLeaveId(null);
      setSheetOpen(true);
      // Editors see the date settings (lock, event) instead of selecting every person on that day.
      if (mode === "edit" || !canRequest || !selectable(date)) return;
      setSheetOpen(true);
      setDates((prev) => {
        const next = new Set(prev);
        if (shiftKey && anchor) {
          const [a, b] = dayIndex(anchor.date) <= dayIndex(date) ? [anchor.date, date] : [date, anchor.date];
          dateRange(a, b).filter((d) => roster.days[d] && selectable(d)).forEach((d) => next.add(d));
        } else if (next.has(date)) next.delete(date);
        else next.add(date);
        return next;
      });
      setAnchor({ staffId: null, date });
    },
    [anchor, canRequest, mode, roster.days, selectable],
  );

  /** Edit view: select cells (click toggles, shift-click selects a range in the row). */
  const clickCell = useCallback(
    (staffId: string, date: string, shiftKey: boolean) => {
      if (mode !== "edit") return clickDate(date, shiftKey);
      setFocusDate(date);
      setDateSettingsOpen(false);
      setFocusLeaveId(null);
      if (!canEdit) return;
      setSheetOpen(true);
      const pseudo = isPseudoRow(staffId);
      setCells((prev) => {
        // Ops and Extra cells are selected on their own: never mixed with staff cells or with each other.
        const next = new Set([...prev].filter((k) => (pseudo ? k.startsWith(`${staffId}|`) : !isPseudoRow(k.split("|")[0]))));
        if (shiftKey && anchor?.staffId === staffId) {
          const [a, b] = dayIndex(anchor.date) <= dayIndex(date) ? [anchor.date, date] : [date, anchor.date];
          dateRange(a, b).forEach((d) => next.add(cellKey(staffId, d)));
        } else {
          const k = cellKey(staffId, date);
          if (next.has(k)) next.delete(k);
          else next.add(k);
        }
        return next;
      });
      setAnchor({ staffId, date });
    },
    [anchor, canEdit, clickDate, mode],
  );

  const clickLeave = useCallback((leaveId: string | null, date: string) => {
    setFocusDate(date);
    setDateSettingsOpen(false);
    setFocusLeaveId(leaveId);
    setSheetOpen(true);
  }, []);

  const clearSelection = useCallback(() => {
    setDates(new Set());
    setCells(new Set());
    setAnchor(null);
  }, []);

  const selection: Selection = useMemo(
    () => ({ dates, cells, focusDate, dateSettingsOpen, focusLeaveId }),
    [dates, cells, focusDate, dateSettingsOpen, focusLeaveId],
  );
  const selectedCount = mode === "edit" ? cells.size : dates.size;

  const panel = (
    <SidePanel
      {...props}
      selection={selection}
      onClear={clearSelection}
      onFocusLeave={(id) => setFocusLeaveId(id)}
      onCloseDateSettings={closeDateSettings}
      onRemoveDate={(d) => setDates((prev) => new Set([...prev].filter((x) => x !== d)))}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:h-[calc(100dvh_-_3.6rem)] lg:flex-none lg:flex-row">
      <section className="flex min-w-0 flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2.5">
          <div className="flex rounded-lg border p-0.5" role="tablist" aria-label="Shift">
            {["A", "B", "C"].map((id) => (
              <button
                key={id}
                role="tab"
                aria-selected={roster.shiftId === id}
                onClick={() => navigate({ shift: id })}
                className={cn(
                  "rounded-md px-3 py-1 text-sm",
                  roster.shiftId === id ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-accent",
                )}
              >
                Shift {id}
                {props.viewer.shiftId === id && <span className="sr-only"> (your shift)</span>}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => navigate({ month: shiftMonth(month, -1) })}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-20 text-center text-sm font-medium">{formatMonth(month)}</span>
            <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => navigate({ month: shiftMonth(month, 1) })}>
              <ChevronRight className="size-4" />
            </Button>
            {month !== today.slice(0, 7) && (
              <Button variant="outline" size="sm" onClick={() => navigate({ month: today.slice(0, 7) })}>
                Today
              </Button>
            )}
          </div>

          {/* Calendar / Roster switch: every role */}
          <div className="flex rounded-full border p-0.5 text-sm" role="group" aria-label="View">
            {(["calendar", "roster"] as const).map((v) => (
              <button
                key={v}
                aria-pressed={view === v}
                onClick={() => navigate({ view: v })}
                className={cn("rounded-full px-3 py-1 capitalize", view === v ? "bg-foreground text-background font-medium" : "text-muted-foreground hover:bg-accent")}
              >
                {v}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={compact} onCheckedChange={toggleCompact} aria-label="Compact strength rows" />
            Compact
          </label>

          {/* Edit / Staff switch: supervisors and Management, deliberately styled differently */}
          {props.hasEditView && (
            <div className="ml-auto flex items-center rounded-lg border-2 border-dashed p-0.5 text-sm" role="group" aria-label="Edit or Staff view">
              <button
                aria-pressed={mode === "staff"}
                onClick={() => navigate({ mode: "staff" })}
                className={cn("flex items-center gap-1.5 rounded-md px-3 py-1", mode === "staff" ? "bg-secondary font-semibold" : "text-muted-foreground")}
              >
                <Eye className="size-3.5" /> Staff view
              </button>
              <button
                aria-pressed={mode === "edit"}
                onClick={() => navigate({ mode: "edit" })}
                className={cn("flex items-center gap-1.5 rounded-md px-3 py-1", mode === "edit" ? "bg-fuchsia-700 text-white font-semibold dark:bg-fuchsia-600" : "text-muted-foreground")}
              >
                <Pencil className="size-3.5" /> Edit view
              </button>
            </div>
          )}
        </div>

        {mode === "edit" && !canEdit && (
          <div className="border-b bg-muted px-4 py-1.5 text-xs font-medium text-muted-foreground">
            View only: you can edit {props.viewer.shiftId ? `Shift ${props.viewer.shiftId}` : "no shift"} only.
          </div>
        )}
        {mode === "staff" && !canRequest && props.viewer.role !== "MANAGEMENT" && (
          <div className="border-b bg-muted px-4 py-1.5 text-xs font-medium text-muted-foreground">
            Viewing {roster.shiftName} (read-only). Switch to Shift {props.viewer.shiftId} to request leave.
          </div>
        )}

        <div className="min-h-0 flex-1">
          {view === "calendar" ? (
            <CalendarView {...props} selection={selection} compact={compact} onDate={clickDate} />
          ) : isDesktop ? (
            <RosterGrid {...props} selection={selection} compact={compact} onDate={focusDateOnly} onCell={clickCell} onLeave={clickLeave} />
          ) : (
            <MobileRoster {...props} selection={selection} compact={compact} onDate={clickDate} onFocusDate={focusDateOnly} onCell={clickCell} onLeave={clickLeave} />
          )}
        </div>
      </section>

      {isDesktop ? (
        // Right-hand panel on desktop
        <aside className="w-[23rem] shrink-0 overflow-y-auto border-l">{panel}</aside>
      ) : (
        // Half-height bottom sheet on mobile, so the calendar stays visible
        <div className="fixed inset-x-0 bottom-16 z-30 rounded-t-2xl border border-b-0 bg-background shadow-[0_-8px_24px_rgba(0,0,0,0.15)]">
          <button
            className="flex w-full flex-col px-4 pb-2 pt-1.5 text-left text-sm"
            onClick={() => setSheetOpen((o) => !o)}
            aria-expanded={sheetOpen}
          >
            <span className="mx-auto mb-1.5 block h-1 w-10 rounded-full bg-muted-foreground/30" aria-hidden />
            <span className="flex w-full items-center justify-between">
              <span className="font-medium">
                {mode === "edit" ? (canEdit ? "Edit" : "Details") : canRequest ? "Request leave and details" : "Details"}
                {selectedCount > 0 && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{selectedCount} selected</span>}
              </span>
              <ChevronUp className={cn("size-4 transition-transform", sheetOpen && "rotate-180")} aria-hidden />
            </span>
          </button>
          {sheetOpen && <div className="max-h-[38dvh] overflow-y-auto border-t">{panel}</div>}
        </div>
      )}
    </div>
  );
}
