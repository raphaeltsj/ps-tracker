# PS Tracker: shared Claude Code context

PS Tracker is a duty roster web app (desktop-first, with a full mobile view) for a shift-based team of about 60-90 people, split into three fixed shifts (A, B, C) of 20-30 people each.

The full spec is `docs/system-context.md`. It is the source of truth: update it whenever a rule changes. Part A is the product rules; Part B (section 17) is the build framework (stack, structure, conventions), previously `docs/framework.md`. Items in [square brackets] there are undecided. Do not invent answers for them; flag them instead.

## Stack and commands

Next.js (App Router, TypeScript), Prisma with SQLite, Tailwind CSS, shadcn/ui, npm. Details in `docs/system-context.md` section 17.

- Setup: `npm install`, then `npm run setup` (creates and seeds `prisma/dev.db`)
- Run: `npm run dev` (http://localhost:3000, pick a demo user)
- Test: `npm test`; lint: `npm run lint`; types: `npm run typecheck`
- Reseed demo data: `npm run db:seed`

## Domain rules (summary)

**Cycle.** Every shift runs 2 days PM, 2 days AM, 2 days Off, repeating (6-day cycle). Shifts are offset so handover runs A to B to C to A. Each person should see their cycle position (for example "PM Day 1 of 2, next: AM").

**Duties and times.** AM 0745-1445, PM 1445-2130, V (night) 2130-0745 (crosses midnight). The duty picker offers V, V(SB), Off(V) and "reset to cycle" only: AM and PM come from the cycle and are never set by hand. An assigned Off is an "Off(V)", the Off awarded for V duty (including for an activated V(SB), whose Off day the supervisor picks).

**DOS/FDO duties.** DOS, DOS2IC and FDO are three names for the same 24-hour duty, reporting at 0800 on top of the shift duty. One day only, on an AM day, the Task is kept, and the next day gets an automatic 0.5 OIL (first half) that cannot be edited or cancelled on its own. Removing the duty removes that OIL.

**V duty.** A temporary overlay, not a separate team. Exactly 1 person covers V each night. The person works 2 days of V on what would have been their 2 Off days after AM; their next 2-day PM block becomes 2 Off (label it "Off(V)"); then AM, AM, Off, Off and back to normal. Nothing about that is stored, so cancelling the V duty restores the PM block. Each of the 2 V days has a standby on V(SB), a different person each day, from the same shift. V(SB) never affects Total Strength, Not in Strength, Working Strength, MFL, or leave slots.

**Special events.** A whole shift reports at a different time. Show "Special Event: report at [time]" on the day header, day view, mobile day card, and affected cells. They do not change MFL or leave slots. Public holidays change nothing.

**MFL (minimum headcount).** Weekday: AM 13, PM 12, V 1. Weekend (Sat, Sun): AM 14, PM 11, V 1. V MFL is always 1. On a shift's Off days it is a "Rest day" and MFL is blank.

**Strength figures (per duty, per day).**
- Total Strength = headcount of the shift.
- Not in Strength = sum of **approved** absences (half-day counts 0.5; pending never counts).
- Working Strength = Total - Not in Strength.
- Available Slot(s) = Total - Not in Strength - MFL (on Rest days MFL is blank, so Total - Not in Strength).
- Values like 21.5 must display cleanly. Colour-code slots: green above 2 left, yellow at 1-2 left, red at none left ("No slots") or below MFL (warning mark).
- Worked example: weekday PM, total 26, 4 full leave + 1 x 0.5 OIL gives Not in 4.5, Working 21.5, Slots 9.5.

**Leave.**
- Types: AL, 0.5 AL, OL, MWO, OML (full name TBD), MC, HL, FCL, CSE, BD, BD-IL, 0.5 OIL, 1 OIL. Half-day types ask first or second half, show actual hours, and look half-filled.
- Custom leave types: name max 6 characters including spaces, with a live counter and chip preview. They count toward Not in Strength.
- One type of leave per person per day (pending, approved, given, half-day, BD / BD-IL all count). Block the request or grant and show the clashing date.
- Birthday: BD shows on the birthday even on an Off day; then the leave is BD-IL on the next closest working day without other leave. BD on an Off day is a marker only.
- Staff requests: leave type, dates (range or specific), notes; may be on Off days; may be submitted with no slots left. Statuses: Pending, Approved, Rejected, Withdrawn. Staff can withdraw pending only.
- Supervisor review: inbox sorted earliest submitted first (name, type, dates, time submitted only; no priority badges). Reject needs a reason and is always available. Approve is disabled with "No slot available on [date]" unless an extra slot exists on every requested date (half-day needs at least 0.5).
- Only supervisors and Management cancel approved leave. Leave they give is already approved and may be set on locked dates and Off days.
- Locked dates: staff cannot request them (disabled in the picker); selecting one shows a "Locked date" badge and the remarks in the right-hand side panel. Supervisors lock, unlock and set special events from that panel, which opens when a date is clicked. Already-approved leave is unaffected. Festive balloting is out of scope.

**Tasks.** Named "Task 1", "Task 2", etc., name only (no description), max 6 characters including spaces. Only Management adds, renames, and deletes them; deleting removes all assignments, so warn first. Assignment is optional, and people on V duty or a DOS/FDO duty can be given a Task. Several people can share a Task. One Task per person per day (a new one replaces the old). No Task on full-day leave (remove any existing; half-day keeps it). Tasks are informational only and never affect duty, leave, strength, MFL, or slots. Show as a separate small tag beside the duty. Supervisors and Management have a Task report (tasks done per person) filtered by year, month, or date range, which must stay readable with many Tasks.

**Roles.**
- Regular Staff: view all shifts, Calendar/Roster switch, see strength, request and withdraw own leave. No edit controls.
- Supervisor: staff view plus Edit view for their own shift only (other shifts read-only). Assign duties and Tasks, swap duties, give/edit/cancel leave (including their own, no approval needed), approve/reject requests, lock dates, set special-event times and V headcount, add custom leave types. In Staff view they can request leave and approve their own request.
- Management: everything a supervisor can do across all shifts, plus lock all shifts at once, manage Tasks, and manage staff records. Management never requests or takes leave.

**UI.**
- Calendar/Roster switch (all roles) is separate from the Edit/Staff switch (supervisors and Management).
- Strength rows are sticky directly below the date header, with a "Compact" toggle that shows only Available Slot(s).
- The request form sits on the same page as the calendar/roster (right panel on desktop, bottom sheet on mobile).
- Clicking a date shows that date's details. It never selects every person on that day: staff see details only, supervisors also get lock and special-event settings.
- Mobile uses bottom tabs (Home, Roster, Requests, Profile). Include a notification bell placeholder.
- Light and dark mode, calm and readable, colours paired with text, icons, or a legend. On the Roster view, AM / PM / Off are colour-coded cells with no text (legend above the grid, tooltips and screen-reader labels); V and V(SB) keep their labels. Suggested: AM amber, PM indigo, V deep navy/purple, V(SB) lighter outline of V, Off grey, Leave teal, Special Event magenta, locked dates hatched with a lock icon.
- Sample data: placeholder staff names that are each a single 5-character word (Alpha, Bravo, Delta...). No realistic personal names.

**Out of scope.** Payroll, timesheets and attendance, HR records, festive balloting.

## Working agreements

- `main` holds working code only. Everyone works on their own branch and merges through a pull request.
- Experiments go on throwaway branches like `try/approach-a` and can be deleted.
- Ask the team before editing shared files (config, schema, package files, this file).
- When a decision is made, update this file and `docs/system-context.md`, then push.
- Personal Claude preferences go in `CLAUDE.local.md`, which is gitignored.
- Never commit secrets. Use a `.env` file that stays out of git.
