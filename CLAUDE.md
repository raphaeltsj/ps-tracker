# PS Tracker: shared Claude Code context

PS Tracker is a duty roster web app (desktop-first, with a full mobile view) for a shift-based team of about 60-90 people, split into three fixed shifts (A, B, C) of 20-30 people each.

The full spec is `docs/system-context.md`. It is the source of truth: update it whenever a rule changes. Part A is the product rules; Part B (section 17) is the build framework (stack, structure, conventions), previously `docs/framework.md`. Items in [square brackets] there are undecided. Do not invent answers for them; flag them instead.

## Stack and commands

Next.js (App Router, TypeScript), Prisma with SQLite, Tailwind CSS, shadcn/ui, npm. Details in `docs/system-context.md` section 17.

- Setup: `npm install`, then `npm run setup` (creates and seeds `prisma/dev.db`)
- Run: `npm run dev` (http://localhost:3000, pick a demo user). To test on a phone, open the "Network" address it prints; that network must be in `allowedDevOrigins` in `next.config.ts` (restart after editing), or buttons won't work and changes won't reach the phone.
- Test: `npm test`; lint: `npm run lint`; types: `npm run typecheck`
- Reseed demo data: `npm run db:seed`

## Domain rules (summary)

**Cycle.** Every shift runs 2 days PM, 2 days AM, 2 days Off, repeating (6-day cycle). Shifts are offset so handover runs A to B to C to A. Days in a block are named "1st" and "2nd": 1st PM, 2nd PM, 1st AM, 2nd AM, 1st OFF, 2nd OFF. Each person should see their cycle position (for example "1st PM, next: AM"), named the same way everywhere.

**Duties and times.** AM 0745-1445, PM 1445-2130, V (night) 2130-0745 (crosses midnight). The duty picker offers V, V(SB), Off(V) and "reset to cycle" only: AM and PM come from the cycle and are never set by hand. An assigned Off is an "Off(V)", the Off awarded for V duty (including for an activated V(SB), whose Off day the supervisor picks).

**DOS/FDO duties.** DOS, DOS2IC and FDO are three names for the same 24-hour duty, reporting at 0800 on top of the shift duty. One day only, on an AM day, and the Task is kept. On a 1st AM it earns an automatic 0.5 OIL (first half) the next day; on a 2nd AM it earns none, because the next day is already Off. That OIL cannot be cancelled and its type and date cannot change, though a supervisor may change which half it covers. Removing the duty removes it. No duty can be assigned on a day the person is on leave.

**Dayworkers, Ops duty and Extra.** Dayworkers are office staff (normally 8-5) outside every shift crew who clock shift duty as Ops duty. Supervisors and Management add them with a name and a username (max 7 characters, no spaces, shown in capitals; never deleted, only made inactive). The username shows on the roster; hovering shows the full name to everyone. Supervisors (own shift) and Management are the only ones who assign dayworkers to a shift: dayworkers do not apply, and have no accounts or sign-in for now (do not build any). Several dayworkers can share a day, so cells stack. A dayworker clocks one shift per day, and Ops duty never changes strength. Supervisors and Management see how many days each dayworker clocked, by year, month, or date range, on the Dayworkers page. Extra shows people serving extra duty from other shifts only (never the host shift), not on a day they are on leave. Support (AM/PM) and Recall are placeholder rows with no logic yet.

**Staff records.** The Staff page (`/staff`) lets supervisors add, edit and deactivate staff for their own shift, and Management do the same for any shift. Fields: name, birthday (optional), role, and shift. A supervisor can only add Regular Staff (never a supervisor) and cannot move someone between shifts or change anyone's role; Management can do both. Like Dayworkers, staff are never deleted, only deactivated (their leave, duty and Task history is kept), and nobody can deactivate their own account. The same page also records each person's **Task proficiency**: for every Task, whether they can do it, are an understudy currently training for it ("(U/S)"), or neither. Kept by supervisors/Management only, never shown to staff, and never affects the roster, duty, or Task assignment — it is a reference, including when reviewing a duty swap on Manage requests (see below).

**V duty.** A temporary overlay, not a separate team. Exactly 1 person covers V each night. The person works 2 days of V on what would have been their 2 Off days after AM; their next 2-day PM block becomes 2 Off (label it "Off(V)"); then AM, AM, Off, Off and back to normal. Nothing about that is stored, so cancelling the V duty restores the PM block. Each of the 2 V days has a standby on V(SB), a different person each day, from the same shift. V(SB) never affects Total Strength, Not in Strength, Working Strength, MFL, or leave slots.

**Duty swaps.** A one-for-one exchange of duties between two people of the **same role** (supervisor with supervisor, staff with staff — never across the two; across shifts: AM, PM and Off only; within a shift: only V or V(SB) days, and V / V(SB) never go to another shift; a V swap includes the 2 PM days after it, where the taker gets the Off(V): tagged and locked with the swap) on one date, or two for a give-and-take: each works the other's duty that day, and the roster shows the worked duty with a "⇄ Name·Shift" tag. Any duties can be exchanged if they differ, but V(SB) only within the same shift, never a V night straight into an AM the next morning (also checked when a V is assigned later), and never on an Extra-duty day. A swap keeps the shifts both people were in when it was made. BD-IL never lands on a swapped day. A DOS/FDO on a swapped day stays with its holder, and the preview warns about it. "Today" is Singapore time. Supervisors may approve their own swap. The Off(V) follows whoever works the V. Strength, leave and Tasks never change. There is no swap on a leave day, and one swap per person per date. Swaps are for today onwards: a pending request expires once its first date has passed, an approved swap cannot be cancelled after its first date, and past swaps drop off the list. Picked on the **roster**, in the same side panel as everything else: a **Request swap** tab next to Request leave (Staff view), or a **Swap** tab next to Duty/Task/Leave (Edit view) — selecting a date (or a person's cell) on the roster first fills it in here, so it usually only needs a partner; the date picker still works normally too, so a date can always be typed or changed by hand instead. Then pick a partner from a list showing everyone's duty that day and why anyone cannot swap. Flow: request, then the partner accepts, then each side's shift supervisor approves (Management can approve both). Supervisors (own shift) and Management can record a swap directly with their side pre-approved; a side they don't supervise still needs that shift's supervisor. Only an approved swap locks anything: duties and leave on its dates, plus any duty change elsewhere that would alter a swapped date (such as a V turning a swapped PM into Off(V)). This lasts until a supervisor or Management cancels. A pending request blocks nothing. A DOS/FDO on a swapped date earns no 0.5 OIL (removed on approval, restored on cancel).

**My Requests and Manage requests.** Status and review only — **no creation form** on either page; requesting or recording a swap is done on the roster (above). `/requests` (My Requests): leave taken by month or year (every leave type shown, even at zero), and "Your requests" — every leave request and duty swap the viewer has made, whatever its status, not only pending. `/manage-requests` (supervisors, own shift; Management, every shift): the pending-leave inbox (earliest submitted first, excluding the viewer's own request), duty swaps needing approval, and the shift's swap history (swaps with a date from today on; past swaps drop off the list). Leave requests sit on the left, swaps on the right (needing approval above the shift's other swaps), so both are visible together on a wide screen; each swap can expand a "Compare proficiency" panel showing what the two people are trained for, to help decide whether to approve. These replace the old separate Home, My requests, and Duty swaps pages; the roster side panel no longer lists the viewer's own requests.

**Leave blocked by duty.** No leave (requested or given) on a day the person already has V duty or a DOS/FDO duty — the reverse of "no duty on a leave day." Remove the duty first if leave is genuinely needed.

**Special events.** A note on a date for the whole shift, with no reporting time. Show "Special Event" and the note on the day header, day view, mobile day card, and affected cells. They do not change MFL or leave slots. Public holidays change nothing.

**Announcements.** When a supervisor locks dates or sets a special event, they can optionally also tell staff with a banner: a message and the date it should start showing from (up to and including the locked/event date, after which it stops on its own). Shown at the top of the app to everyone on the affected shift (or every shift, for a Management-wide lock); several active announcements combine into one banner instead of stacking, its text sliding left to right slowly enough to read. Closing it is per-viewer only. Separately, and regardless of the banner choice, every active staff member on the affected shift(s) gets a bell notification that a locked date or special event was set.

**MFL (minimum headcount).** Weekday: AM 13, PM 12, V 1. Weekend (Sat, Sun): AM 14, PM 11, V 1. V MFL is always 1. On a shift's Off days it is a "Rest day" and MFL is blank.

**Strength figures (per duty, per day).**
- Total Strength = headcount of the shift.
- Not in Strength = sum of **approved** absences (half-day counts 0.5; pending never counts).
- Working Strength = Total - Not in Strength.
- Available Slot(s) = Total - Not in Strength - MFL (on Rest days MFL is blank, so Total - Not in Strength).
- Values like 21.5 must display cleanly. Colour-code slots: green above 2 left, yellow at 1-2 left, red at none left ("No slots") or below MFL (warning mark).
- Worked example: weekday PM, total 26, 4 full leave + 1 x 0.5 OIL gives Not in 4.5, Working 21.5, Slots 9.5.

**Leave.**
- Types: AL, 0.5 AL, OL, MWO, OML (ordinary medical leave: MC without a medical certificate), MC, HL, FCL, CSE, BD, BD-IL, 0.5 OIL, 1 OIL, GRW (Growth Day), 0.5 GRW. Half-day types ask first or second half, show actual hours, and look half-filled.
- Custom leave types: name max 6 characters including spaces, with a live counter and chip preview. They count toward Not in Strength.
- One type of leave per person per day (pending, approved, given, half-day, BD / BD-IL all count). Block the request or grant and show the clashing date.
- Birthday: BD shows on the birthday even on an Off day; then the leave is BD-IL on the next closest working day without other leave. BD on an Off day is a marker only.
- Annual limits, shown on My Requests: AL and OL combined, 18; MC, 14; OML, 3; BD and BD-IL combined, always 1. Every other type (MWO, HL, FCL, CSE, OIL, custom types) has no limit and just keeps a running total, as before. A limit is checked against the whole year regardless of which period (month or year) the "Leave taken" list is showing.
- Staff requests: leave type, dates (range or specific), notes; may be on Off days; may be submitted with no slots left. Statuses: Pending, Approved, Rejected, Withdrawn. Staff can withdraw pending only.
- Supervisor review: inbox sorted earliest submitted first (name, type, dates, time submitted only; no priority badges). Reject needs a reason and is always available. Approve is disabled with "No slot available on [date]" unless an extra slot exists on every requested date (half-day needs at least 0.5).
- Only supervisors and Management cancel leave, whether approved or pending. Leave they give is already approved and may be set on locked dates and Off days.
- Locked dates: staff cannot request them (disabled in the picker); selecting one shows a "Locked date" badge and the remarks in the right-hand side panel. Supervisors lock, unlock and set special events from that panel, which opens when a date is clicked, with the option to also announce it (see Announcements below). Already-approved leave is unaffected. Festive balloting is out of scope.

**Tasks.** Named "Task 1", "Task 2", etc., name only (no description), max 6 characters including spaces. Only Management adds, renames, and deletes them; deleting removes all assignments, so warn first. Assignment is optional, and people on V duty or a DOS/FDO duty can be given a Task. Several people can share a Task. One Task per person per day (a new one replaces the old). No Task on full-day leave (remove any existing; half-day keeps it). Tasks are informational only and never affect duty, leave, strength, MFL, or slots. Show as a separate small tag beside the duty. Supervisors and Management have a Task report (tasks done per person) filtered by year, month, or date range, which must stay readable with many Tasks.

**Roles.**
- Regular Staff: view all shifts, Calendar/Roster switch, see strength, request and withdraw own leave. No edit controls.
- Supervisor: staff view plus Edit view for their own shift only (other shifts read-only). Assign duties and Tasks, approve / record / cancel duty swaps for their own shift's side, give/edit/cancel leave (including their own, no approval needed), approve/reject requests, lock dates, set special events, add custom leave types, add dayworkers, assign Ops duty and Extra for their own shift, and manage staff records (add, edit, deactivate) for their own shift — they can only add Regular Staff, not another supervisor, and cannot move someone to another shift or change anyone's role. In Staff view they can request leave and approve their own request.
- Management: everything a supervisor can do across all shifts (including Ops duty and Extra for any shift), plus lock all shifts at once, manage Tasks, and manage staff records for any shift (including adding a supervisor, moving someone between shifts, and changing role). Management never requests or takes leave.

**UI.**
- Calendar/Roster switch (all roles) is separate from the Edit/Staff switch (supervisors and Management).
- Strength rows are sticky directly below the date header, with a "Compact" toggle that shows only Available Slot(s). The other rows (Support, Extra, Recall, Ops duty) sit at the bottom of the roster.
- The request form sits on the same page as the calendar/roster (right panel on desktop, bottom sheet on mobile). On desktop the panel can be collapsed and reopened (a small edge button), for everyone, to see the full roster; the roster grid opens scrolled to today, not the 1st of the month, so today-onwards dates for a request or swap are visible without scrolling first.
- Clicking a date (header, calendar cell, or mobile week strip) shows that date's details. It never selects every person on that day. For supervisors and Management it replaces the normal duty / Task / leave tools with that date's lock and special-event settings; clicking the date again, or Close, returns to the normal tools. Staff see read-only details only.
- Selecting a person's date (a roster cell) opens the normal duty / Task / leave tools, defaulting to the **Task** tab.
- In Staff view (and on a shift the viewer can't edit), clicking or tapping **someone else's** cell highlights it and shows their duty, Task, swap, DOS/FDO and visible leave for that date, read-only, at the top of the side panel. Only the viewer's **own** cells pick leave dates.
- Mobile uses bottom tabs (Roster, Requests, Manage for supervisors and Management, Profile). Include a notification bell placeholder. The mobile Roster view has a **Day / Grid** switch: Day is the one-day list (default); Grid is the full month grid in a screen-high box that scrolls sideways, with names and dates pinned. The choice is remembered per browser.
- Light and dark mode, calm and readable, colours paired with text, icons, or a legend. On the Roster view, AM / PM / Off are colour-coded cells with no text (legend above the grid names each colour without timings; tooltips and screen-reader labels carry the details); V, V(SB) and Off(V) keep a text label. Colours: AM yellow (solid in dark mode too, since see-through yellow reads as brown there), PM blue, V purple, V(SB) a neutral grey dashed outline (standby, not duty), Off grey, Off(V) a light violet tint with the "Off(V)" label, Leave teal, Special Event magenta, locked dates hatched with a lock icon. Task and DOS/FDO tags have a near-solid background so they read on any duty colour.
- Sample data: placeholder staff names that are each a single 5-character word (Alpha, Bravo, Delta...). No realistic personal names.

**Out of scope.** Payroll, timesheets and attendance, HR records, festive balloting.

## Working agreements

- `main` holds working code only. Everyone works on their own branch and merges through a pull request.
- Experiments go on throwaway branches like `try/approach-a` and can be deleted.
- Ask the team before editing shared files (config, schema, package files, this file).
- When a decision is made, update this file and `docs/system-context.md`, then push.
- Personal Claude preferences go in `CLAUDE.local.md`, which is gitignored.
- Never commit secrets. Use a `.env` file that stays out of git.
