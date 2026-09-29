"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, ChevronUp, Eye, PanelRightClose, PanelRightOpen, Pencil } from "lucide-react";
import { CalendarView } from "@/components/roster/calendar-view";
import { MobileRoster } from "@/components/roster/mobile-roster";
import { MonthPicker } from "@/components/roster/month-picker";
import { RosterGrid } from "@/components/roster/roster-grid";
import { SidePanel } from "@/components/roster/side-panel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { dateRange, dayIndex, formatMonth, shiftMonth } from "@/lib/dates";
import type { Viewer } from "@/lib/permissions";
import { isPseudoRow, type DayworkerOption, type ExtraCandidate, type LeaveSummary, type LeaveTypeOption, type RosterData, type TaskOption } from "@/lib/roster-types";
import type { SwapCandidate } from "@/components/swaps/swap-form";
import { SwapWaitingBanner } from "@/components/swaps/swap-waiting-banner";
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
  /** Record mode: people the viewer supervises (person 1). The partner list loads per date. */
  swapFirstPeople: SwapCandidate[];
  /** Swap requests waiting for the viewer's answer, or approvals waiting on their shift(s). */
  swapsWaiting: number;
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
  // A person whose cell was clicked where the viewer cannot edit it (Staff view, or another shift):
  // the panel shows that person's duty, Task and leave on focusDate, read-only.
  focusStaffId: string | null;
};

// One look for every toolbar switch (shift, Calendar/Roster, phone Day/Grid): a 32px bordered box
// with rounded segments, the selected one in the accent.
const SEGMENTED = "flex h-8 items-center gap-0.5 rounded-lg border p-0.5 text-sm";
function segment(selected: boolean): string {
  return cn("h-full rounded-md px-2", selected ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground hover:bg-accent");
}

export function RosterWorkspace(props: WorkspaceProps) {
  const { roster, month, view, mode, canEdit, canRequest, canRequestLocked, today } = props;
  const viewerId = props.viewer.id;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [dates, setDates] = useState<Set<string>>(new Set());
  const [cells, setCells] = useState<Set<string>>(new Set());
  const [focusDate, setFocusDate] = useState<string | null>(roster.dates.includes(today) ? today : null);
  const [dateSettingsOpen, setDateSettingsOpen] = useState(false);
  const [focusLeaveId, setFocusLeaveId] = useState<string | null>(null);
  const [focusStaffId, setFocusStaffId] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<{ staffId: string | null; date: string } | null>(null);
  const [compact, setCompact] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const isDesktop = useIsDesktop();
  // Phones: the bottom sheet's live height (collapsed or open), so the page and the Grid box make room
  // for it and nothing ends up permanently underneath it.
  const sheetRef = useRef<HTMLDivElement>(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setSheetHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, [isDesktop]);
  // Month, shift and view changes reload the page data: show that something is happening.
  const [navPending, startNav] = useTransition();

  useEffect(() => {
    try {
      // Per-viewer convenience only.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCompact(localStorage.getItem("ps-compact") === "1");
      setPanelCollapsed(localStorage.getItem("ps-panel-collapsed") === "1");
    } catch {}
  }, []);
  const toggleCompact = (v: boolean) => {
    setCompact(v);
    try {
      localStorage.setItem("ps-compact", v ? "1" : "0");
    } catch {}
  };
  /** Clicking a person's cell reopens a collapsed panel, so its details and tools are never hidden. */
  const expandPanel = useCallback(() => {
    setPanelCollapsed(false);
    try {
      localStorage.setItem("ps-panel-collapsed", "0");
    } catch {}
  }, []);
  const togglePanel = () => {
    setPanelCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("ps-panel-collapsed", next ? "1" : "0");
      } catch {}
      return next;
    });
  };
  // Phones show one day at a time by default; "Grid" shows the desktop month grid, scrolled sideways.
  const [phoneGrid, setPhoneGrid] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhoneGrid(localStorage.getItem("ps-phone-grid") === "1");
    } catch {}
  }, []);
  const togglePhoneGrid = (v: boolean) => {
    setPhoneGrid(v);
    try {
      localStorage.setItem("ps-phone-grid", v ? "1" : "0");
    } catch {}
  };

  const navigate = useCallback(
    (changes: Record<string, string>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(changes)) next.set(k, v);
      startNav(() => router.push(`${pathname}?${next.toString()}`));
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
   *
   * The mobile week strip passes `openSheet: false`: it already shows the day's read-only details
   * (event, lock, strength) inline above the list, so forcing the sheet open there would just bury
   * that list under the lock/event editor the moment you browse to a day.
   */
  const focusDateOnly = useCallback(
    (date: string, openSheet = true) => {
      if (focusDate === date && dateSettingsOpen) {
        setFocusDate(null);
        setDateSettingsOpen(false);
        return;
      }
      setFocusDate(date);
      setDateSettingsOpen(true);
      setFocusLeaveId(null);
      setFocusStaffId(null);
      if (openSheet) setSheetOpen(true);
    },
    [focusDate, dateSettingsOpen],
  );

  const closeDateSettings = useCallback(() => {
    setFocusDate(null);
    setDateSettingsOpen(false);
    setFocusStaffId(null);
  }, []);

  /** Staff view: pick dates for a request (click toggles, shift-click selects a range). */
  const clickDate = useCallback(
    (date: string, shiftKey: boolean) => {
      setFocusDate(date);
      setDateSettingsOpen(true);
      setFocusLeaveId(null);
      setFocusStaffId(null);
      setSheetOpen(true);
      // Editors see the date settings (lock, event) instead of selecting every person on that day.
      if (mode === "edit" || !canRequest || !selectable(date)) return;
      // Picking a date to request leave or a swap: reopen a collapsed panel so the request tabs show.
      expandPanel();
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
    [anchor, canRequest, expandPanel, mode, roster.days, selectable],
  );

  /** Someone's date, read-only: their duty, Task and leave at the top of the panel. */
  const showPerson = useCallback((staffId: string, date: string) => {
    setFocusDate(date);
    setDateSettingsOpen(false);
    setFocusLeaveId(null);
    setFocusStaffId(isPseudoRow(staffId) ? null : staffId);
    setSheetOpen(true);
  }, []);

  /**
   * Edit view: select cells (click toggles, shift-click selects a range in the row). Staff view: the
   * viewer's own cells pick dates for a request; anyone else's cell shows their details read-only.
   */
  const clickCell = useCallback(
    (staffId: string, date: string, shiftKey: boolean) => {
      expandPanel();
      if (mode !== "edit") {
        if (staffId === viewerId || isPseudoRow(staffId)) return clickDate(date, shiftKey);
        return showPerson(staffId, date);
      }
      if (!canEdit) return showPerson(staffId, date);
      setFocusDate(date);
      setDateSettingsOpen(false);
      setFocusLeaveId(null);
      setFocusStaffId(null);
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
    [anchor, canEdit, clickDate, expandPanel, mode, showPerson, viewerId],
  );

  const clickLeave = useCallback((leaveId: string | null, date: string) => {
    expandPanel();
    setFocusDate(date);
    setDateSettingsOpen(false);
    setFocusLeaveId(leaveId);
    setFocusStaffId(null);
    setSheetOpen(true);
  }, [expandPanel]);

  const clearSelection = useCallback(() => {
    setDates(new Set());
    setCells(new Set());
    setAnchor(null);
  }, []);

  const selection: Selection = useMemo(
    () => ({ dates, cells, focusDate, dateSettingsOpen, focusLeaveId, focusStaffId }),
    [dates, cells, focusDate, dateSettingsOpen, focusLeaveId, focusStaffId],
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
    <div
      className="flex min-h-0 flex-1 flex-col lg:h-[calc(100dvh_-_3.6rem_-_var(--banner-h))] lg:flex-none lg:flex-row"
      style={{ "--sheet-h": `${isDesktop ? 0 : sheetHeight}px` } as React.CSSProperties}
    >
      <section className="relative flex min-w-0 flex-1 flex-col pb-(--sheet-h)" aria-busy={navPending}>
        <h1 className="sr-only">
          {roster.shiftName} {view === "calendar" ? "calendar" : "roster"}, {formatMonth(month)}
          {mode === "edit" ? " (Edit view)" : ""}
        </h1>
        {navPending && (
          <div className="absolute inset-x-0 top-0 z-40 h-0.5 overflow-hidden bg-primary/15" role="progressbar" aria-label="Loading">
            <div className="h-full w-1/3 animate-[loading-bar_1s_ease-in-out_infinite] bg-primary" />
          </div>
        )}
        {props.swapsWaiting > 0 && (
          <div className="px-4 pt-3">
            <SwapWaitingBanner count={props.swapsWaiting} href={props.hasEditView ? "/manage-requests" : "/requests"} />
          </div>
        )}
        {/* Toolbar: every control is one 32px-high box with the same shape, so they sit on one line
            (supervisors included) from about 1280px wide with the panel open. */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-b px-4 py-2.5">
          <div className={SEGMENTED} role="tablist" aria-label="Shift">
            {["A", "B", "C"].map((id) => (
              <button key={id} role="tab" aria-selected={roster.shiftId === id} onClick={() => navigate({ shift: id })} className={segment(roster.shiftId === id)}>
                Shift {id}
                {props.viewer.shiftId === id && <span className="sr-only"> (your shift)</span>}
              </button>
            ))}
          </div>

          <div className="flex h-8 items-center gap-1">
            <Button variant="ghost" size="icon" className="size-8" aria-label="Previous month" onClick={() => navigate({ month: shiftMonth(month, -1) })}>
              <ChevronLeft className="size-4" />
            </Button>
            <MonthPicker month={month} today={today} onPick={(m) => navigate({ month: m })} />
            <Button variant="ghost" size="icon" className="size-8" aria-label="Next month" onClick={() => navigate({ month: shiftMonth(month, 1) })}>

              <ChevronRight className="size-4" />
            </Button>
            {month !== today.slice(0, 7) && (
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => navigate({ month: today.slice(0, 7) })}>
                Today
              </Button>
            )}
          </div>

          {/* Calendar / Roster switch: every role */}
          <div className={SEGMENTED} role="group" aria-label="View">
            {(["calendar", "roster"] as const).map((v) => (
              <button key={v} aria-pressed={view === v} onClick={() => navigate({ view: v })} className={cn(segment(view === v), "capitalize")}>
                {v}
              </button>
            ))}
          </div>

          {/* Phones only: one day at a time, or the full month grid scrolled sideways */}
          {!isDesktop && view === "roster" && (
            <div className={SEGMENTED} role="group" aria-label="Phone layout">
              {([
                [false, "Day"],
                [true, "Grid"],
              ] as const).map(([grid, label]) => (
                <button key={label} aria-pressed={phoneGrid === grid} onClick={() => togglePhoneGrid(grid)} className={segment(phoneGrid === grid)}>
                  {label}
                </button>
              ))}
            </div>
          )}

          <label className="flex h-8 items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={compact} onCheckedChange={toggleCompact} aria-label="Compact strength rows" />
            Compact
          </label>

          {/* Right-aligned together, so they wrap as one unit on narrower screens. */}
          {(props.hasEditView || isDesktop) && (
            <div className="ml-auto flex items-center gap-2">
              {/* Edit / Staff switch: supervisors and Management. The dashed border marks it as the mode switch. */}
              {props.hasEditView && (
                <div className="flex h-8 items-center gap-0.5 rounded-lg border-2 border-dashed p-0.5 text-sm" role="group" aria-label="Edit or Staff view">
                  <button
                    aria-pressed={mode === "staff"}
                    aria-label="Staff view"
                    title="Staff view"
                    onClick={() => navigate({ mode: "staff" })}
                    className={cn("flex h-full items-center gap-1.5 rounded-md px-2", mode === "staff" ? "bg-secondary font-semibold" : "text-muted-foreground hover:bg-accent")}
                  >
                    <Eye className="size-3.5" aria-hidden /> Staff
                  </button>
                  <button
                    aria-pressed={mode === "edit"}
                    aria-label="Edit view"
                    title="Edit view"
                    onClick={() => navigate({ mode: "edit" })}
                    className={cn("flex h-full items-center gap-1.5 rounded-md px-2", mode === "edit" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-accent")}
                  >
                    <Pencil className="size-3.5" aria-hidden /> Edit
                  </button>
                </div>
              )}

              {/* In the toolbar (not on the panel edge) so it never covers the panel's own tabs; a square the
                  same height as the other controls. */}
              {isDesktop && (
                <button
                  type="button"
                  onClick={togglePanel}
                  aria-expanded={!panelCollapsed}
                  aria-label={panelCollapsed ? "Show the side panel" : "Hide the side panel"}
                  title={panelCollapsed ? "Show panel" : "Hide panel"}
                  className="flex size-8 items-center justify-center rounded-lg border text-foreground/80 hover:bg-accent hover:text-foreground"
                >
                  {panelCollapsed ? <PanelRightOpen className="size-[18px]" aria-hidden /> : <PanelRightClose className="size-[18px]" aria-hidden />}
                </button>
              )}
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

        <div className={cn("min-h-0 flex-1 transition-opacity", navPending && "pointer-events-none opacity-50")}>
          {view === "calendar" ? (
            <CalendarView {...props} selection={selection} compact={compact} onDate={clickDate} />
          ) : isDesktop || phoneGrid ? (
            // On a phone the grid gets its own box, one screen tall minus the tab bar and the bottom sheet (its
            // measured height, so it shrinks while the sheet is open): scroll the page to bring it into view,
            // then it scrolls both ways inside with the date header and name column pinned.
            <div className={isDesktop ? "h-full" : "h-[calc(100dvh-4rem-var(--sheet-h))] min-h-64"}>
              <RosterGrid {...props} selection={selection} compact={compact} onDate={focusDateOnly} onCell={clickCell} onLeave={clickLeave} />
            </div>
          ) : (
            <MobileRoster {...props} selection={selection} compact={compact} onDate={clickDate} onFocusDate={focusDateOnly} onCell={clickCell} onPerson={showPerson} onLeave={clickLeave} />
          )}
        </div>
      </section>

      {isDesktop ? (
        // Right-hand panel on desktop, collapsible (toolbar button) so the roster can take the full width.
        !panelCollapsed && <aside className="w-[23rem] shrink-0 overflow-y-auto border-l">{panel}</aside>
      ) : (
        // Half-height bottom sheet on mobile, so the calendar stays visible
        <div ref={sheetRef} className="fixed inset-x-0 bottom-16 z-30 rounded-t-2xl border border-b-0 bg-background shadow-[0_-8px_24px_rgba(0,0,0,0.15)]">
          <button
            className="flex w-full flex-col px-4 pb-2 pt-1.5 text-left text-sm"
            onClick={() => setSheetOpen((o) => !o)}
            aria-expanded={sheetOpen}
          >
            <span className="mx-auto mb-1.5 block h-1 w-10 rounded-full bg-muted-foreground/30" aria-hidden />
            <span className="flex w-full items-center justify-between">
              <span className="font-medium">
                {mode === "edit" ? (canEdit ? "Edit" : "Details") : canRequest && (!focusStaffId || focusStaffId === viewerId) && (!focusLeaveId || props.myLeaves.some((l) => l.id === focusLeaveId)) ? "Request leave and details" : "Details"}
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
