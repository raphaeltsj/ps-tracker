# PS Tracker: System Context Document

*Duty roster management for a shift-based team | Version 1.23 | Draft for editing*

## 1. Purpose of this document

This document describes how the PS Tracker duty roster system is meant to work: the shifts, the duty cycle, the staffing rules, the user roles, and the UI expectations. It is written so that a person, or an AI assistant such as Claude, can read it and understand the system without any other background. Use it as the reference when designing UI mockups, writing specifications, or building features.

It has two parts:

- **Part A: Product rules** (sections 2 to 16): how the system should behave.
- **Part B: Build framework** (section 17): the tech stack, project structure, and build conventions. Read both before implementing any feature.

> **How to edit:** items in [square brackets] are still undecided. Section 16 lists assumptions and open questions. Update this document whenever a rule changes so it stays the single source of truth.

**Changes in 1.23:** a supervisor can cancel the whole of a multi-day leave or only the clicked / selected day(s), and the staff member is notified either way (12.4); the legend names the leave groups by their codes (AL/OL, MC/OML/MWO/HL/FCL, GRW/CSE, BD/BD-IL/OIL) (14.2); the roster toolbar is a single row of same-height controls, with the panel button a square at its end (14.3); the Task report no longer lists each person's dates (9.2); browser support is defined and checked in Firefox and WebKit, with month filters now month and year selects (17.4).

**Changes in 1.22:** cancelling leave no longer depends on clicking the small leave chip: in Edit view, the Leave tab lists the leave on the selected cells with Cancel leave and Details / edit (12.4), and in Staff view a supervisor is told to switch to Edit view; Request leave / Request swap are hidden while looking at someone else's cell or leave (11.1); the desktop side panel is hidden and shown with a labelled "Hide panel" / "Show panel" button at the end of the roster toolbar, instead of a small button on the panel edge that covered the panel's own tabs (14.3). Phone readability pass (14.1): the page leaves room for the bottom sheet at its actual height, so nothing (the last rows, Other duties, the legend) is stuck underneath it, and the phone Grid box shrinks to fit above the sheet; tables that scroll sideways no longer widen the whole page (which made phones zoom out); calendar day chips fit inside their cells at phone widths; and phone text is at least 11px (Day-list tags 12px).

**Changes in 1.21:** a new colour scheme across the app (14.2): a cool slate neutral base with a deep ink-navy accent (dark mode is deep navy rather than black); duties follow the time of day, AM a warm apricot, PM a deeper dusk blue, V a night indigo; leave chips are no longer all teal but coloured by group, Annual (AL, OL: teal), Health & care (MC, OML, MWO, HL, FCL: rose), Training & growth (CSE, GRW: green), Birthday & in lieu (BD, BD-IL, OIL: plum), and custom types neutral slate (12.1); the legend names the leave groups; DOS/FDO tags are solid ink and duty-swap tags azure, so neither is mistaken for leave; the Edit view switch uses the accent instead of magenta, which stays reserved for special events; the colour legend moves below the roster grid; section 17 gains a colour-token guide for building new UI.

**Changes in 1.20:** the Staff records page's Task proficiency editor is redesigned from a per-person expanding picker into a single matrix (people down, Tasks across, one click-to-cycle button per cell), which stays usable as Management adds more Tasks; Management can filter the matrix by shift (9.3, 11.6, 14).

**Changes in 1.19:** in Staff view (and on a shift the viewer can't edit), clicking someone else's cell highlights it and shows that person's duty, Task, swap, DOS/FDO and visible leave for the date, read-only, at the top of the side panel; only the viewer's own cells pick leave dates (11.1); duty colours are now AM yellow, PM blue, V purple, and V(SB) a neutral grey dashed outline, since it is standby rather than duty (14.2); Task and DOS/FDO tags have a near-solid background so they stay readable on any duty colour, including the solid dark-mode AM yellow (14.2); on phones a **Day / Grid** switch shows the full month grid, scrolled sideways with names and dates pinned, as an alternative to the one-day list (14.1, 14.3); phones on the local network can use the dev server (17.2).

**Changes in 1.18:** the desktop Roster view opens scrolled to today's column instead of the 1st of the month, so picking a date for a swap or leave request no longer starts on a page of unusable past dates (14.3.1); the right-hand side panel can be collapsed and reopened on desktop, for every role (14.3); two new leave types, **GRW** and **0.5 GRW** (Growth Day) (12.1); the leave-type dropdown shows a uniform code chip + name for every type, including in its own closed state, instead of a plain "CODE - Name" string that varied in shape per type.

**Changes in 1.17:** locking dates or setting a special event can now also raise a dismissible **announcement banner** at the top of the app, several combining into one, plus a bell notification either way (6, 12.5, 13.1); the Staff records page adds **Task proficiency** (not trained / understudy / proficient per person, per Task, never shown to staff), compared on Manage requests when reviewing a duty swap (9.3, 11.6); Manage requests is redesigned with leave on the left and swaps on the right (11.5); Tasks are seeded 12 at a time instead of 5 (14.6).

**Changes in 1.16:** a duty swap's date(s) fill in from whatever is already selected on the roster, so the date picker is only needed to change them (11.4); adds a **Staff records** page (`/staff`) for supervisors (their own shift, Regular Staff only) and Management (any shift, including supervisors and shift moves), resolving the old "field list to confirm" (11.6); the Edit view's "Give leave" tab is renamed **Leave**.

**Changes in 1.15:** supervisors can only swap with supervisors, and regular staff only with regular staff (11.4).

**Changes in 1.14:** who can swap is settled: **within a shift only V or V(SB) days**, and V / V(SB) **never across shifts**; across shifts, AM, PM and Off only. A V swap now **includes the 2 PM days after it** (the taker gets the Off(V), the giver works PM): they are tagged, shown on the swap and locked like the V nights (11.4). This replaces the 1.12 wording "only ever between two different shifts".

**Changes in 1.13:** a duty swap is picked on the **roster** again (a Request swap / Swap tab alongside the other roster tools), not on My Requests / Manage requests: the roster stays in view while picking it (11.4). My Requests and Manage requests hold **no creation form**: they are status and review only. My Requests' "Your requests" now shows every leave request and swap with its status (Pending, Approved, Rejected, ...), not only pending ones (11.5).

**Changes in 1.12:** a duty swap is only ever between two **different** shifts, never within the same shift (11.4); no leave can be requested or given on a day already committed to V duty or a DOS/FDO duty (12.3); My Requests' "leave taken" now shows every leave type, even one taken zero times (12.6).

**Changes in 1.11:** Home, My requests and Duty swaps are replaced by two pages: **My Requests** (leave taken, and pending leave and swaps) and **Manage requests** (the leave inbox and swap approvals, for supervisors and Management), section 11.5; the roster side panel no longer lists the viewer's own requests.

**Changes in 1.10:** clicking a date now replaces the normal duty / Task / leave tools with that date's lock and special-event settings, instead of showing both at once (11.2, 14); selecting a person's date opens the normal tools on the Task tab by default (11.2); Off(V) shows an "Off(V)" text chip on the roster instead of a border overlay (14.2).

**Changes in 1.9:** dayworkers and Ops duty, with a duty count for supervisors and Management (5.3); Extra shift duty from other shifts (5.4); Support and Recall placeholder rows, and the rows at the bottom of the roster (5.5); the colour legend shows names only, with no timings (14.2).

**Changes in 1.8:** cycle days read "1st AM", "2nd OFF" (3.2); a DOS/FDO duty earns its 0.5 OIL only on a 1st AM (5.2); no duty can be assigned on a day a person is on leave (5.1); special events have no report time (6); OML is Ordinary Medical leave (12.1); supervisors can cancel a pending request, and the automatic 0.5 OIL can change half but not type, date or existence (12.4).

**Changes in 1.7:** supervisors no longer set AM or PM, and an assigned Off is an "Off(V)" (5.1); new DOS / DOS2IC / FDO 24-hour duty with its automatic 0.5 OIL (5.2); V MFL is always 1 (7); Available Slot(s) colours are red / yellow / green (8); clicking a date opens its details, where supervisors lock it or set a special event (11.1, 11.2, 12.5); the Task report copes with many Tasks (9.2).

**Changes in 1.6:** one type of leave per person per day (12.3); AM, PM and Off are colour-coded without text on the Roster view (14.2); Tasks can be assigned to people on V duty (9); new Task report for supervisors and Management (9.2); the build framework (previously `docs/framework.md`) is merged in as section 17.

# Part A: Product rules

## 2. System overview

PS Tracker is a web application (desktop-first, with a full mobile view) that manages a duty roster for a team working a fixed rotating shift system. Its main jobs are:

- Show who is working which duty (AM, PM, V) or is off on any day, for every shift.
- Let regular staff view every shift roster (calendar view or roster view) and request leave with notes, and let supervisors approve or reject requests or give leave directly.
- Track staffing levels against a minimum requirement (MFL) so supervisors can see how many people can still take leave.
- Handle exceptions: V (night) duty with standby people, special-event notes, locked leave dates, duty swaps handled by supervisors, and custom leave types.
- Let management maintain the list of Tasks and let supervisors optionally assign them to their shift.
- Keep dayworkers (office staff outside the shift crew) who clock shift duty as Ops duty, and show people serving extra duty on another shift.

The team has about 60-90 people, divided into three shifts of 20-30 people each. The app is called **PS Tracker** (working name; no branding decided yet).

## 3. Shifts and the duty cycle

### 3.1 Shifts

Staff belong to three fixed shifts: **Shift A, Shift B, and Shift C**. Each shift has 20-30 people and its own supervisor. A shift is a fixed group of people. The **duties** (AM, PM, V, V(SB), and Off) are what a shift works on a given day.

### 3.2 The 6-day cycle

Every shift follows the same cycle: **2 days PM, then 2 days AM, then 2 days Off**, repeating. The cycle is 6 days long.

The shifts are offset so that handover runs **A to B to C to A**: B takes over from A, C takes over from B, and A takes over from C. At any moment one shift is on PM, one is on AM, and one is resting. The table below shows one illustrative 6-day window (the starting day is arbitrary).

| **Day**     | **1** | **2** | **3** | **4** | **5** | **6** |
|-------------|-------|-------|-------|-------|-------|-------|
| **Shift A** | PM    | PM    | AM    | AM    | OFF   | OFF   |
| **Shift B** | OFF   | OFF   | PM    | PM    | AM    | AM    |
| **Shift C** | AM    | AM    | OFF   | OFF   | PM    | PM    |

Each staff member should be able to see their position in the cycle. Days in a block are named **"1st"** and **"2nd"**: 1st PM, 2nd PM, 1st AM, 2nd AM, 1st OFF, 2nd OFF. The full label reads for example "1st PM, next: AM". Use the same naming everywhere a date's cycle day is shown.

## 4. Duty timings

| **Duty**      | **Default time** | **Notes**                                                       |
|---------------|------------------|-----------------------------------------------------------------|
| **AM**        | 0745 - 1445      |                                                                 |
| **PM**        | 1445 - 2130      |                                                                 |
| **V (night)** | 2130 - 0745      | The night shift, written as V. Crosses midnight. See section 5. |

## 5. V duty (night shift)

The night shift is written as **V**. V duty is a **temporary overlay on the normal cycle**, not a separate team. **Exactly 1 person** covers V each night (see section 7): the app refuses a second person on V for a night that already has one, and refuses V on a day that is not one of the shift's Off days.

A person assigned to V duty follows this rule:

- They work **2 days of V on what would have been their 2 Off days after AM**.
- Their following 2-day PM block is then **replaced by 2 days Off**.
- They then continue with 2 days AM, 2 days Off, and return to the normal cycle.

Example for a person in Shift A (compare with the normal cycle in section 3.2):

| **Day**    | **1** | **2** | **3** | **4** | **5** | **6** | **7** | **8** | **9** | **10** | **11** | **12** |
|------------|-------|-------|-------|-------|-------|-------|-------|-------|-------|--------|--------|--------|
| **Normal** | PM    | PM    | AM    | AM    | OFF   | OFF   | PM    | PM    | AM    | AM     | OFF    | OFF    |
| **With V** | PM    | PM    | AM    | AM    | V     | V     | OFF\* | OFF\* | AM    | AM     | OFF    | OFF    |

V = night duty. OFF\* = Off that replaces the PM block after V duty. The UI labels these **"Off(V)"**: the Off awarded for V duty, visibly different from a regular Off day. Nothing about them is stored, so **cancelling the V duty puts the PM block straight back**.

### 5.1 V and V(SB) are duties

The duty picker offers **V, V(SB), and Off(V)**, plus "reset to cycle". A supervisor picks the person, the date(s), and the duty.

- **AM and PM are never assigned by hand.** They come from the shift cycle. Supervisors change the cycle only through V duty and its Off(V) days.
- **Off(V)** is an Off awarded because of V duty. It covers both the 2 days the app creates after a V block, and an Off a supervisor gives by hand, for example to a V(SB) who was activated and did the V duty. The app does not track activation: the supervisor simply picks the Off day.
- **Reset to cycle** removes whatever was assigned, so the person follows the normal rotation again.
- **Duty on a leave day is pending.** A supervisor may assign V, V(SB), Off(V) or a DOS/FDO duty on a day the person has leave (approved or pending, including BD / BD-IL), except **medical leave (MC, OML, HL)**, which the app refuses and names. The leave stays and still counts in the strength figures. The person gets a bell notification, and their cell turns **amber (`warning`, the reserved "pending" colour) with a dashed outline and a "Pending" tag** (legend: "Duty on leave (pending)") so they can plan: they may **swap the duty away** (section 11.4), or the supervisor removes the duty, or the leave is cancelled. The Pending flag clears by itself once any of those happens. A DOS/FDO stays with its holder through a swap, so only removing it clears that day. The flag shows only where the leave itself is visible to the viewer. Extra shift duty is still refused on any leave day (section 5.4).
- **No leave on a day the person already has V duty or a DOS/FDO duty**, the other way around (section 12.3). Remove the duty first if leave is genuinely needed that day.

V duty runs for **2 days**, and the block has a **standby person** on **V(SB)**, who comes from **within the same shift** as the person on V duty.

- **The same person** is on V(SB) for **both** V nights of the block. Picking V(SB) on either Off day assigns that person to both nights, and resetting either night to the cycle clears both.
- **One standby per block:** if someone else is already V(SB) on either night, the app refuses and names them (reset them to the cycle first). Like V, V(SB) goes only on the shift's 2 Off days after AM.
- On the roster, a standby person's cell for that day reads "V(SB)", so it is clearly different from a person actually working V.
- V(SB) does **not** affect Total Strength, Not in Strength, Working Strength, MFL, or leave slots.
- Supervisors (own shift) and Management (any shift) assign V, V(SB) and Off(V) from the duty picker.

### 5.2 DOS / DOS2IC / FDO duties

A second kind of duty sits **on top of** the shift duty. It has three names, **DOS**, **DOS2IC**, and **FDO**, for what is the same 24-hour duty; this document calls them **DOS/FDO duties**. The supervisor picks which of the three names applies.

- **24 hours, reporting at 0800.** The person still works their shift timing as well.
- **One day only**, and it **must fall on an AM day** for that person. The app refuses any other day.
- The person **keeps their Task**, if they have one: a DOS/FDO duty does not remove it.
- **A 1st AM duty earns a 0.5 OIL the next day, automatically**, for the first half of that 2nd AM. A **2nd AM duty earns nothing**, because the next day is already an Off day.
- That 0.5 OIL is not negotiable: it cannot be cancelled, and its type and date cannot change. A supervisor may change **which half** it covers. It disappears only when the DOS/FDO duty is removed. If the next day already has leave, the duty cannot be assigned (one type of leave per day, section 12.3).
- On the roster the duty shows as a small tag (DOS, DOS2IC, or FDO) beside the duty colour, like a Task tag.
- DOS/FDO duties do not change Total Strength, MFL or slots on the day itself; the 0.5 OIL the next day counts as 0.5 like any half-day leave.

### 5.3 Dayworkers and Ops duty

A **dayworker** is office staff who normally works 8 to 5 and is **not part of any shift crew**. They still have to **clock shift duty**, and the system keeps a count so supervisors and Management can check **how many times each dayworker did shift duty**.

- **Records.** Supervisors and Management add dayworkers. Each has a **name** and a **username**. The username is what the roster shows: **at most 7 characters**, no spaces, shown in **capitals** (for example "TYL"), and unique. Dayworkers are never deleted, only made **inactive**, so their past duty stays in the count. An inactive dayworker cannot be given new duty.
- **Ops duty** is the shift duty that dayworkers clock. It shows in the **OPS DUTY** row at the bottom of the roster (section 5.5) as the dayworker's username.
- **Assigning.** A supervisor (own shift) or Management (any shift) assigns one or more dayworkers to a date, or a run of dates, on that shift's roster. **More than one dayworker can clock on the same day**, so the cell stacks their usernames.
- **One shift per day.** A dayworker clocks at most one shift on a day. Assigning a second shift on the same day is refused, naming the shift they are already on.
- **Not part of the crew.** Ops duty does **not** change Total Strength, Not in Strength, Working Strength, MFL, or leave slots.
- **Everyone can see who they are.** Hovering a username shows the dayworker's full name, for every role. On mobile the name is written next to the username.
- **Duty count.** Supervisors and Management have a **Dayworkers** page to add, edit and deactivate dayworkers, and to see how many days each dayworker clocked Ops duty, in total and per shift, for a **year, month, or date range**. Like the Task report it counts up to today unless "include scheduled duty" is ticked, and opening a row shows the dates.
- **Supervisors assign, dayworkers do not apply.** Only supervisors (own shift) and Management put dayworkers on a shift. Dayworkers do **not** request or apply for duty themselves, and they have **no account and no sign-in** for now: they exist only as records that supervisors and Management manage. Do not add dayworker logins, a dayworker view, or self-clocking until this is decided.

### 5.4 Extra shift duty

People **serving punishment by working extra shift duty** show in the **EXTRA** row of the shift they are working for (the host shift).

- **Only from other shifts.** Someone can never serve Extra on their own shift. The picker lists only people from the other shifts.
- A supervisor (host shift) or Management assigns them to one or more dates. **Several people can serve Extra on the same day**, and the cell stacks them. Each shows their name with the letter of the shift they come from, and hovering explains it.
- It is a duty, so it is **refused on a day the person is on leave** (approved or pending), and a person serves Extra for **one host shift per day**.
- Extra does **not** change strength or slots for either shift. [To confirm.]

### 5.5 The rows at the bottom of the roster

Below the last crew member, in the order of the parade state: **SUPPORT (AM/PM), EXTRA, RECALL, OPS DUTY**. The strength rows and Available Slot(s) **do not move**: they stay in sticky rows under the date header (section 8.1).

- **Ops duty** and **Extra** are described in sections 5.3 and 5.4.
- **Support (AM/PM)** and **Recall** are **placeholders**. The rows are shown so the roster matches the parade state, but they have no data and no rules yet. Their cells are greyed and marked "Not active yet". [Rules to be defined.]
- **Layout.** One column per date. When several names share a day they **stack vertically and the row grows taller**, so nothing is clipped. Usernames use a small, tight type so a 7-character username fits a column.
- **Editing.** In Edit view a supervisor clicks cells in the Ops duty or Extra row (shift-click for a run of dates) and edits them in the right-hand panel: who is already there (with remove), and a searchable list to add from.
- **Mobile.** The same rows appear as an "Other duties" list under the selected day's crew list.

## 6. Special events

On some dates an entire shift has something on that the roster should flag. This is called a **special event**. It carries a **note saying what the event is, and no reporting time**: duty timings stay as they are.

- The UI must show a clear "Special Event" indicator, with the note, on the day header, the day view, the mobile day card, and the affected staff cells.
- Special events **do not change MFL or leave slots** for that day. They are a note for the whole shift.
- Supervisors can set a special event for their own shift; Management for any shift.
- Like a locked date, setting a special event offers the option to **also announce it**: see section 13.1.

**Public holidays** do not affect MFL or duty. The team works as usual, so they need no special handling in the roster.

## 7. Minimum headcount (MFL)

MFL is the minimum number of people who must be working a duty on a given day.

| **Duty** | **Weekday MFL** | **Weekend MFL** |
|----------|-----------------|-----------------|
| **AM**   | 13              | 14              |
| **PM**   | 12              | 11              |
| **V**    | 1               | 1               |

- **V MFL is always 1.** It is not raised for specific dates.
- A shift on its Off days shows a "Rest day" state and **MFL is left blank** for that day. Leave taken on an Off day still counts in Not in Strength (see section 8).

## 8. Strength figures and leave slots

For each duty and each day, the roster view shows four figures:

| **Figure**            | **Meaning**                                                    | **Calculation**                                                   |
|-----------------------|----------------------------------------------------------------|-------------------------------------------------------------------|
| **Total Strength**    | Total number of people in the shift.                           | Headcount of the shift                                            |
| **Not in Strength**   | People not working because of approved leave or other absence. | Sum of approved absences (0.5 for a half-day)                     |
| **Working Strength**  | People available to work.                                      | Total Strength - Not in Strength                                  |
| **Available Slot(s)** | How many more people can take leave without going below MFL.   | Total Strength - Not in Strength - MFL (on Off days MFL is blank) |

### Rules

- Only **approved** leave counts toward these figures. Pending requests are not counted.
- **Half-day leave (0.5 AL, 0.5 OIL) counts as 0.5.** Someone on a half-day leave reduces Working Strength by 0.5 and adds 0.5 to Not in Strength. Values such as 21.5 must display cleanly.
- Custom leave types count toward Not in Strength like the common types.
- **Off days (Rest day):** staff can take leave on their Off days. Not in Strength counts the people on leave as usual and Total Strength stays as usual. **MFL is left blank**, so both Working Strength and Available Slot(s) are simply Total Strength - Not in Strength.
- Available Slot(s) are colour-coded: **green** above 2 left, **yellow** at 1 or 2 left (including halves such as 0.5 and 1.5), and **red** at none left ("No slots") or below MFL (with a warning mark).

### Worked example

Weekday PM, shift total 26, with 4 people on full leave and 1 person on 0.5 OIL:

- Not in Strength = 4 + 0.5 = **4.5**
- Working Strength = 26 - 4.5 = **21.5**
- Available Slot(s) = 26 - 4.5 - 12 = **9.5**

Rest day (Off day) example, shift total 26, with 3 people on leave and MFL blank:

- Not in Strength = **3**
- Working Strength = 26 - 3 = **23**
- Available Slot(s) = 26 - 3 = **23** (no MFL to subtract)

### 8.1 Where the figures appear

- The figures sit in **sticky rows directly below the date header** of the roster, so they stay in view while scrolling through staff: Total Strength, Not in Strength, Working Strength, MFL, and Available Slot(s), for each duty and day.
- A **toggle** (for example "Compact") minimises the strength counts and MFL and shows **only Available Slot(s)**. This is the quick view for staff planning leave.
- In the Calendar view, each date shows its duty and the Available Slot(s) at a glance; the full figures appear when the date is selected.
- The other roster rows (Support, Extra, Recall, Ops duty) sit at the **bottom** of the roster, not under the date header (section 5.5).

## 9. Specific duties (Tasks)

Besides their daily duty (AM, PM, V, V(SB), or Off), staff can be given a **specific duty** that shows what they are doing during that duty. To avoid confusion with the duty types, this document calls them **Tasks**.

- Tasks are named **Task 1, Task 2, Task 3**, and so on. There is a variety of them. Only the **name** is stored: a Task has **no description** and no other details.
- A Task name is limited to **6 characters maximum, spaces included**, with a live counter (for example "6/6"). "Task 1" to "Task 9" fit exactly. From the tenth Task, "Task 10" is 7 characters, so Management renames it (for example "T10"). Names are **unique** (ignoring upper/lower case), so two Tasks can never share a name.
- **Only Management** can **add**, **rename**, and **delete** Tasks.
- **Task assignment is optional.** Supervisors can assign Tasks to people in their own shift, but nobody is required to have a Task.
- **People on V duty can be given a Task** for their V days, in the same way as people on AM or PM. A **DOS/FDO duty also keeps its Task** (section 5.2).
- **Two or more people can be assigned the same Task.** The UI must support assigning one Task to several people at once, and showing everyone who shares it.
- **No Task on full-day leave.** If a staff member takes a full-day leave of any kind, they have **no Task for that day**. Any existing Task on that day is removed, and a Task cannot be assigned to them while the leave stands. Half-day leave does **not** remove the Task.
- **One Task per person per day.** A person can hold only one Task on the same day. Assigning a different Task to them for that day replaces the previous one.
- Regular Staff can see which Task they and their colleagues are assigned, as part of the roster view.
- Tasks are **purely informational**. They only show what people are doing for that duty. They do **not** affect leave, Total Strength, Not in Strength, Working Strength, MFL, or leave slots.
- Tasks **never conflict with or replace the schedule**. A person's duty (AM / PM / V / Off) and leave status are unaffected by their Task.

### 9.1 How Tasks appear

- On the roster, a person's cell shows their duty (by colour for AM / PM / Off, with a "V" or "V(SB)" label for those duties, see 14.2) together with a separate small Task tag that reads simply "Task 2". The Task tag sits alongside the duty and never overwrites or changes it.
- The Task assignment form (supervisor) lets them pick a date or date range, optionally choose a Task, and select one or more people from their shift. Each person can hold only one Task per day.
- The Task management screen (Management only) lists all Tasks with Add, Rename, and Delete actions.
- **Deleting a Task deletes all of its existing assignments.** Before deleting, the UI must show a **clear warning** to Management that all existing assignments of that Task will be removed (ideally showing how many people and dates are affected), and require confirmation.

### 9.2 Task report

Supervisors and Management have a **Task report** that shows which Tasks each person has done and how many days of each.

- **Filters:** a **year**, a **month**, or a **date range** (up to 3 years), and a shift (one shift or all shifts). Supervisors start on their own shift; Management starts on all shifts. Like the roster, every shift can be viewed.
- **"Done" means up to today.** By default only days up to and including today are counted. A tick box includes scheduled Tasks after today.
- **Layout:** a summary card per Task (days and number of people), then a table of staff (rows) by Task (columns) with a total per person and per Task. There is no per-person list of dates (it would get long, and the roster already shows who did which Task on which day). A tick box hides staff with no Tasks in the period.
- **Many Tasks:** the report must stay readable when there are many Tasks (and many staff).
  - A **Tasks filter** (searchable checklist with Select all / Clear) picks which Tasks become columns.
  - Tasks nobody did in the period are **hidden by default** (a tick box shows them), and the page says how many were hidden.
  - The summary cards are a single **horizontal strip**, busiest Task first, so they never push the table down.
  - The table scrolls inside its own frame with the **header row, Staff column, Total column, and totals row pinned**, so names and totals stay visible while scrolling across many Task columns.
- The report counts **Task assignments only**. It does not change duty, leave, strength, MFL, or slots. A deleted Task and its assignments no longer appear.
- Regular Staff do not see the report.

### 9.3 Task proficiency

Separate from day-to-day Task assignment, supervisors and Management keep a record of **who is trained for which Task**, managed on the Staff records page (section 11.6).

- For each person and each Task, one of three states: **not trained**, **understudy** (currently training, shown as **"(U/S)"**), or **proficient** (can do it).
- Kept by whichever supervisor manages that person's shift, or Management for any shift — the same permission as editing the staff record itself.
- **Never shown to Regular Staff**, anywhere. It is not on the roster, a person's own profile, or any staff-facing page.
- **Purely a record.** It does not affect duty, leave, strength, MFL, slots, or Task assignment.
- Used when reviewing a duty swap on Manage requests (section 11.4, 11.5): a "Compare proficiency" panel on the swap shows both people's proficient and understudy Tasks, so the approving supervisor can judge whether the swap leaves each duty adequately covered.

## 10. Users and permissions

There are three user roles. **Everyone can view the roster of every shift.** The differences are in what they can do.

| **Capability**                            | **Regular Staff** | **Supervisor**          | **Management**             |
|-------------------------------------------|-------------------|-------------------------|----------------------------|
| **View roster of all shifts**             | Yes               | Yes                     | Yes                        |
| **Calendar view / Roster view switch**    | Yes               | Yes                     | Yes                        |
| **Edit view / Staff view switch**         | No                | Yes                     | Yes                        |
| **See strength figures**                  | Yes               | Yes                     | Yes                        |
| **Request own leave (with notes)**        | Yes               | Yes (in Staff view)     | Not needed                 |
| **Withdraw own pending request**          | Yes               | Yes                     | Not needed                 |
| **Request leave on locked dates**         | No                | Yes                     | Not needed                 |
| **Give pre-approved leave to staff**      | No                | Own shift only          | All shifts                 |
| **Give leave to self (Edit view)**        | No                | Yes, no approval needed | Not needed                 |
| **Edit leave and its remarks**            | No                | Own shift only          | All shifts                 |
| **Cancel approved leave**                 | No                | Own shift only          | All shifts                 |
| **Approve / reject pending requests**     | No                | Own shift only          | All shifts                 |
| **Approve own request (from Staff view)** | No                | Yes                     | Not needed                 |
| **Lock dates for events (with remarks)**  | No                | Own shift only          | All shifts, or all at once |
| **Assign duties (AM, PM, V, V(SB), Off)** | No                | Own shift only          | All shifts                 |
| **Assign Tasks (optional)**               | No                | Own shift only          | All shifts                 |
| **Request a duty swap (partner accepts)** | Yes               | Yes                     | Not needed                 |
| **Approve / reject / cancel duty swaps**  | No                | Own shift's side only   | All shifts, both sides     |
| **Record a duty swap directly**           | No                | For own shift's staff   | All shifts                 |
| **Manage staff records**                  | No                | Own shift only          | All shifts                 |
| **Set special events**               | No                | Own shift only          | All shifts                 |
| **Add custom leave type**                 | No                | Yes                     | Yes                        |
| **Add / rename / delete Tasks**           | No                | No                      | Yes                        |
| **View Task report**                      | No                | Yes (all shifts)        | Yes (all shifts)           |
| **Add / edit dayworkers**                 | No                | Yes                     | Yes                        |
| **Assign Ops duty (dayworkers)**          | No                | Own shift only          | All shifts                 |
| **Assign Extra shift duty**               | No                | Own shift only          | All shifts                 |
| **View dayworker duty counts**            | No                | Yes (all shifts)        | Yes (all shifts)           |

- **Regular Staff** can view every shift roster and request leave. They have no edit controls and cannot request leave on locked dates.
- **Supervisors** have the regular staff view plus an edit view for **their own shift only**. Other shifts appear in clearly marked read-only mode. They do not have the staff restrictions.
- **Management** can do everything a supervisor can do across all three shifts, and is the **only** role that can add, rename, and delete Tasks, and manage staff records for every shift (supervisors manage their own shift's; section 11.6). Management does **not** request or take leave of any sort. Their role is the bigger picture of roster and duty management.

## 11. Role views and functions

### 11.1 Regular Staff view

Regular staff can see the roster of **all shifts**, which helps them plan their schedules. The staff view includes:

- **Two views with an easy switch:** a **Calendar view** and a **Roster view**, toggled with a clearly visible switch button.
- **Date details panel:** selecting a date shows a **side panel** with that date's duty, strength figures, remarks, lock and special event, plus the staff member's own leave for the date. Clicking the date header of the roster shows these details only; it never selects anything.
- **Seeing a colleague's day:** clicking (or on mobile, tapping) **someone else's** cell highlights that cell and shows their duty, Task, duty swap, DOS/FDO, leave and cycle position for the date, **read-only**, at the top of the side panel. The Request leave / Request swap tools are **hidden** while someone else's cell or leave is shown, since requests are only ever the viewer's own; clicking back on their own row brings them back, with any dates already picked. It shows only what the roster already shows: other people's pending leave and leave notes stay hidden. Only the viewer's **own** cells pick dates for a leave request (as do the Calendar view and the mobile "Select for leave" button). The same read-only card appears for supervisors in Edit view on a shift they cannot edit.
- **Request leave on the same page:** the request leave form sits on the **same page as the Calendar view and Roster view**, in the right-hand panel (on mobile, a bottom sheet over the page). While booking, staff can see the dates they want, whether each date is **AM, PM, or Off**, and what has already been planned (other leave, locked dates, Available Slot(s)).
- **Selecting dates:** staff pick a **date range or specific (individual) dates** directly on the calendar or roster. Selected dates are highlighted and appear in the form.
- **Request details:** choose a leave type and add **additional notes** so the supervisor understands the request. Half-day types ask for first or second half. Leave can be requested on **Off days** too. Staff can still submit a request when no slots are left, and the supervisor decides.
- **Approval status:** see whether each request is Pending, Approved, or Rejected. Their list of requests is in the same right-hand panel.
- **Withdraw:** staff can withdraw their own **pending** request. They **cannot** cancel leave that has already been approved; only a supervisor can.
- **Locked dates:** some dates are locked for events. Staff **cannot apply for leave** on locked dates, which are disabled in the date picker. Selecting a locked date shows that it is a **locked date**, with the **remarks** in the side panel on the right explaining why (for example a festive period or an important meeting).
- **Birthday leave:** on a staff member's birthday the roster and calendar show **BD**, even when the birthday falls on an Off day. In that case the leave becomes **BD-IL**, placed on their next closest working day (see section 12.1).
- **Leave taken:** a summary of how many days of each leave type they have taken (approved only), for the current month or the current year. Lives on the **My Requests** page (section 11.5), not the roster side panel.

### 11.2 Supervisor view

Supervisors are also part of the shift roster, so they get the **regular staff view** as well as an **edit view**. A prominent **switch button** toggles between **Edit view** and **Staff view**. Supervisors do **not** have the staff restrictions. In Edit view, for their own shift, they can:

- Assign **duties** (V, V(SB), Off(V)) from a single duty picker, or reset a day to the cycle. AM and PM come from the cycle and are not set by hand (see section 5.1). Assign **DOS/FDO duties** the same way (section 5.2).
- **Swap duties** between staff of the same role (see section 11.4), from the Swap tab on the roster: AM, PM and Off with another shift; V and V(SB) within the shift.
- Assign **Tasks** to their staff, including people on V duty. Task assignment is **optional**, and each person holds only one Task per day, and a person on full-day leave cannot be given a Task.
- Track Tasks done in the **Task report** (section 9.2).
- Add and edit **dayworkers**, assign **Ops duty** and **Extra shift duty** for their own shift, and check dayworker duty counts (sections 5.3 to 5.5).
- **Give leave** to staff, **including themselves**: select specific dates or a date range, pick the leave type, and add remarks. Leave given by a supervisor is **already approved**, so it has no approval step.
- **Edit leave** (type, dates, and remarks) and **cancel approved leave**. Only supervisors and Management can cancel approved leave. They can also set leave on staff Off days.
- **Approve or reject pending** leave requests from staff (a reason is required when rejecting). A request **cannot be approved** unless an extra slot is available on every requested date (see section 12.3).
- **Lock dates for events** and add **remarks** explaining why. Locked dates block staff leave requests, but **supervisors can still give leave on locked dates**.
- Set special events (a note for the whole shift) and add custom leave types. **Clicking a date** (the header, a calendar cell, or the mobile week strip) replaces the normal duty / Task / leave tools with that date's settings: lock or unlock it with remarks, and set, change or remove its special event. Clicking the date again, or closing the panel, returns to the normal tools. Selecting a person's date instead opens those tools directly, on the **Task** tab by default.
- **In Staff view**, a supervisor can **submit leave requests** like regular staff, and can **approve their own request**.
- **In Edit view**, a supervisor can **cancel approved leave** and **give leave** to staff, **including themselves**. Leave a supervisor gives themselves is already approved and needs no approval.
- **Manage staff records** for their own shift: add, edit, and deactivate (section 11.6). They can only add Regular Staff, not another supervisor, and cannot move someone to another shift or change anyone's role.

### 11.3 Management view

Management can do everything a supervisor can do across **all shifts**, but does **not** request or take leave of any sort. Their role is to have the **bigger picture** of roster and duty management. In addition, Management can:

- **Rename** Tasks.
- **Add** new Tasks or **delete** Tasks. Deleting a Task deletes all of its existing assignments, so a clear warning is shown first.
- Tasks need **no description**, only a name (maximum 6 characters, spaces included).
- **Lock dates for all shifts at once**, in addition to locking dates for a single shift.
- Track Tasks done across all shifts in the **Task report** (section 9.2).
- Add and edit **dayworkers**, assign **Ops duty** and **Extra shift duty** for any shift, and check dayworker duty counts (sections 5.3 to 5.5).
- **Manage staff records** for any shift (section 11.6): everything a supervisor can do there, plus adding a supervisor and moving someone between shifts.

### 11.4 Duty swaps between staff

Swapping duties (often called shift swaps) is **in scope**, between two people of the **same role** (staff swap with staff, supervisors swap with supervisors — never across the two). Staff request swaps in the app, and supervisors approve them. Picking one is done on the **roster** itself, in the same side panel as Request leave (staff) or Duty / Task / Leave (Edit view): a **Request swap** tab, or a **Swap** tab, sits alongside them. This keeps the shift's roster in view while picking the swap: selecting a date, or a person's cell, on the roster first fills in the date(s) here — the date picker still works normally too, so a date can always be typed or changed by hand instead. Then pick a partner from a list that shows everyone's duty that day and why anyone cannot swap (a different role never appears at all; same duty, on leave or birthday leave, already in a swap, on Extra duty, the same-shift V/V(SB)-only rule, or V then AM).

**What a swap is.** A **one-for-one exchange** of duties between two people. On each swapped date, each person works the other's duty. For example, if A's Bravo is on AM and C's Charl is on PM, then after the swap Bravo works PM and Charl works AM. On A's roster, Bravo's cell shows PM with a "⇄ Charl·C" tag, and C's roster shows the reverse.

**Who can swap with whom.**

- **Across shifts:** AM, PM and Off (including Off(V)) only.
- **Same role only:** supervisors swap only with supervisors, and regular staff only with regular staff (checked at every step; the partner list only shows people of the same role).
- **Within a shift:** only a **V or V(SB)** day, since everyone else in the shift shares the same duty that day. For example, Bravo takes Alpha's V night, or Delta covers Frost's standby.
- **V and V(SB) never go to another shift:** the standby comes from the V person's shift, and the Off(V) falls on that shift's PM block.

- **One date or two.** A swap has one date (a straight exchange) or two (a give-and-take: Charl covers Bravo's AM on the 3rd, and Bravo covers Charl's PM on the 7th). Each date is an exchange of that day's duties, so a two-date swap works the same way as two one-date exchanges.
- **V and V(SB) swap 2 for 2.** V is worked in 2-night blocks, with one V(SB) for both nights (section 5.1), so a swap involving V or V(SB) must cover **both nights of the block, with the same partner**. A single night is refused, naming the two dates, and the partner list shows "V / V(SB): pick both nights of the block" until both are picked.
- **Any duties** can be exchanged: AM, PM, Off, V, V(SB), Off(V). The two duties must differ on each date, and Off and Off(V) count as the same day off.
- **V swaps include the Off(V) days.** When a V is swapped, the 2 PM days after it are swapped too: the person who takes the V gets the Off(V) on those days, and the person who gave it away works PM. They are stored with the swap as follow-on days, show the ⇄ tag and appear on the swap card and preview. They are locked like the V nights (no leave or duty changes) and must be free the same way when the swap is made (no leave, Extra duty or other swap). Cancelling the swap restores all of it.
- **Rest after V.** V ends at 0745, so no swap may leave anyone on V followed by AM at 0745 the next morning. Swap both V nights, or pick another date. The same check runs when a supervisor later assigns a V next to a swapped day.
- **No double booking.** No swap on a day either person serves Extra duty for another shift, and no Extra duty on a day an approved swap holds.
- **DOS/FDO on a swapped day.** The DOS stays with its holder (24 hours from 0800, on top of the swapped duty) and earns no 0.5 OIL. The preview and the approval card say so, so approvers can move the DOS to someone on AM first.
- **Birthday leave.** BD-IL never lands on a swapped day; it moves to the next free working day.
- **Swaps keep the shifts they were made in.** If someone later moves shift, or leaves the shift roster, an approved swap still exchanges the duties that were agreed.
- **Today onwards only.** "Today" is Singapore time (the app time zone, `NEXT_PUBLIC_APP_TIME_ZONE`), whatever time zone the server runs in. Swaps are for dates from today on. A swap can still be cancelled on its first date. Once that date has passed, the swap is part of what was worked and can no longer be cancelled. It drops off the My Requests / Manage requests lists once all its dates have passed, but the roster still shows who worked what. A pending request whose first date passes before it is fully approved becomes **Expired**.
- **Off(V) follows the V.** Whoever actually works a V earns the Off(V), on the PM block after it (see above).
- **Strength does not change.** Each crew loses one person and gains one on that duty, so Total, Not in, Working Strength, MFL and slots stay as they were. V cover (V on duty / MFL) counts the crew's own duty.
- **Leave and Tasks do not move.** No swap on a date where either person has leave (pending or approved, including BD / BD-IL), with one exception: a person whose V, V(SB) or Off(V) was assigned over their (non-medical) leave (section 5.1) may swap that duty away, to a partner who is not on leave, as long as they do not take over a V or V(SB) in return. Their leave stays; for a V, the PM block after it comes back to them as usual, and leave that runs over it becomes ordinary leave on those PM days. A person can be in only one swap per date (pending or approved). A Task stays with its holder on a swapped date.
- **DOS/FDO.** A DOS/FDO duty stays with its holder, but a DOS on a swapped date earns **no 0.5 OIL**. Approving the swap removes that OIL, and cancelling the swap restores it.

**Flow.** Request → partner accepts or declines → each side's shift supervisor approves → Approved.

- Staff (and supervisors in their own name) request a swap for today or later, with an optional note. The requester can withdraw it until it is approved.
- Once the partner accepts, the supervisor of each person's shift approves their side. A same-shift swap needs one approval. Management can approve both sides at once. A supervisor may approve their own swap (as with their own leave). Either supervisor can reject (a reason is required) while the swap is pending.
- A supervisor (for someone in their own shift) or Management can also **record** a swap directly. That counts as both people's agreement and approves every side the recorder supervises, so a swap with another shift still needs that shift's supervisor.
- Every step re-checks the rules above. Duties, leave or other swaps may have changed since the request, and a pending swap that can no longer go through shows why.
- **Once approved**, the swapped dates are held for both people. Duties (V, V(SB), Off(V), DOS/FDO) and leave cannot change on those dates, but Tasks still can. A duty change on another day that would change a swapped date is refused as well; for example, a V placed before a swapped PM would turn that PM into Off(V). A supervisor of either shift, or Management, can cancel the swap until its first date has passed, which restores both people's own duties.
- A **pending** request never blocks leave or duties. It is re-checked when it is accepted and approved, and shows why it can no longer go through. This means nobody can block someone else's leave just by sending them a request.
- **Finding a partner:** pick the date first. The list then shows everyone's duty that day, with the people who cannot swap (and why) set aside: same duty, on leave or birthday leave, already in a swap, on Extra duty, V(SB) across shifts, or V then AM.
- Swaps waiting for the viewer show as a banner on the Roster page, and count toward the bell, which opens My Requests (staff) or Manage requests (supervisors and Management). The roster's date details list that day's swaps and who covers each swapped duty.

### 11.5 My Requests and Manage requests

Two pages replace the old separate Home, My requests, and Duty swaps pages. Neither holds a form to create a request: that stays on the **roster** (section 11.4), next to the shift it is for. These two pages are for **status and review**.

**My Requests** (`/requests`), for staff and supervisors (not Management, who never requests). Desktop shows **Leave taken** on the left and **Your requests** on the right, side by side; both stack on mobile.

- **Leave taken**: a list, one line per leave type (or combined limit group; section 12.6), for the current month or the current year. Every type shows, even at zero.
- **Your requests**: every leave request and duty swap the viewer has made, in one place, with a shared **Pending / Approved / Rejected / All** filter. Withdrawn ones never show: once withdrawn there is nothing left to track. Pending items keep their actions here: withdraw a leave request, accept or decline a swap as partner, and a supervisor can still self-approve their own pending leave.

**Manage requests** (`/manage-requests`), for supervisors (their own shift) and Management (every shift). On a wide screen, **leave requests sit in a column on the left** and **duty swaps in a wider column on the right**, so both are visible together without scrolling past each other; both stack on mobile.

- **Leave requests**: every pending request for the shifts they edit, **earliest submitted first** (a supervisor's own request is excluded here: that is self-service on My Requests). Approve or reject (a reason is required) inline.
- **Duty swaps needing your approval**, and the shift's swap history with a date from today on (approve, reject, or cancel an approved one; past swaps drop off the list). Each swap can expand a **Compare proficiency** panel (section 9.3) listing both people's proficient and understudy Tasks, to help judge whether approving it leaves each duty adequately covered.

The roster no longer shows the viewer's own pending requests in its side panel: that list moved to My Requests.

### 11.6 Staff records

The **Staff** page (`/staff`) lets supervisors and Management add, edit and deactivate staff, and manage Task proficiency.

- Supervisors manage staff for their **own shift** only. They can add a new person (name, birthday optional; role is fixed to Regular Staff) and edit an existing one's name and birthday, but cannot add a supervisor, move anyone to another shift, or change anyone's role.
- Management can do all of that for **any shift**, and additionally add a supervisor, move a staff member between shifts, and change their role.
- Deactivating (never deleting, like Dayworkers) keeps a person's leave, duty and Task history intact and drops them off the active roster; they can be reactivated later. Nobody can deactivate their own account.
- The same page also manages each person's **Task proficiency** (section 9.3): for every Task, mark them not trained, an understudy ("(U/S)"), or proficient. Never shown to staff; purely a reference for supervisors and Management.

## 12. Leave management

### 12.1 Common leave types

Common leave types and their full names:

| **Code**    | **Full name**             | **Notes**                                                                                                                    |
|-------------|---------------------------|------------------------------------------------------------------------------------------------------------------------------|
| **AL**      | Local leave               |                                                                                                                              |
| **0.5 AL**  | Half-day local leave      | Requester chooses the first half or second half of the duty timing; the UI shows the actual hours. Counts as 0.5.            |
| **OL**      | Overseas leave            |                                                                                                                              |
| **MWO**     | Mental wellness off       |                                                                                                                              |
| **OML**     | Ordinary Medical leave    | Medical leave without a medical certificate.                                                                                 |                                                                                                                              |
| **MC**      | Medical leave             |                                                                                                                              |
| **HL**      | Hospitalised leave        |                                                                                                                              |
| **FCL**     | Family care leave         |                                                                                                                              |
| **CSE**     | Course leave              |                                                                                                                              |
| **BD**      | Birthday leave            | Shown on the birthday, even on an Off day. See the birthday rules below.                                                     |
| **BD-IL**   | Birthday off in lieu      | Used when the birthday falls on an Off day. Placed on the next closest working day.                                          |
| **0.5 OIL** | Half-day off in lieu      | Requester chooses the first half or second half of the duty timing (for example PM first half: 1445 to 1800). Counts as 0.5. |
| **1 OIL**   | Off in lieu (full day)    |                                                                                                                              |
| **GRW**     | Growth Day                |                                                                                                                              |
| **0.5 GRW** | Half-day growth day       | Requester chooses the first half or second half of the duty timing; the UI shows the actual hours. Counts as 0.5.            |

- Each type appears as a short-code chip on the roster. Half-day types (0.5 AL, 0.5 OIL and 0.5 GRW) look half-filled, and pending leave has a dashed outline and a "?".
- Chips are coloured by **group**, so leave of the same kind looks the same at a glance (the code still names the exact type); every group has the same visual weight:

| **Group**              | **Types**                    | **Colour**   |
|------------------------|------------------------------|--------------|
| **Annual**             | AL, 0.5 AL, OL               | Teal         |
| **Health & care**      | MC, OML, MWO, HL, FCL        | Rose         |
| **Training & growth**  | CSE, GRW, 0.5 GRW            | Green        |
| **Birthday & in lieu** | BD, BD-IL, 0.5 OIL, 1 OIL    | Plum         |
| **Custom** (12.2)      | Any supervisor-added type    | Neutral slate |

**Birthday leave rules (BD and BD-IL):**

- If a staff member's birthday falls on a **working day**, they take **BD** (birthday leave) on that day.
- If the birthday falls on an **Off day**, the leave becomes **BD-IL**, an off in lieu for the birthday.
- **BD is still shown** on the roster and calendar on the birthday, even when it falls on an Off day.
- The **BD-IL** is placed on the **next closest working day** the staff member has after the birthday **that does not already have leave** (one type of leave per day, section 12.3). A V night or a DOS/FDO day never counts as free (no leave on those days, section 5.1), and a birthday that falls on a V night is treated like one on an Off day.
- While BD or BD-IL is on a day, no other leave can be requested or given for that day.
- A BD shown on an Off day is a marker only and does not count in Not in Strength; the BD-IL day counts like other leave [to confirm].
- Birthdays come from the staff record, which Management maintains (section 11.3).

### 12.2 Custom leave types

Supervisors can add a new leave type. The name is limited to **6 characters maximum, spaces included**. The form should show a live counter (for example "4/6"), validate the length, and preview how the chip will look on the roster.

### 12.3 Leave requests from staff

- Staff submit a request, on the same page as the roster and calendar views, with a leave type, **a date range or specific dates**, and **additional notes** for the supervisor. For 0.5 AL and 0.5 OIL they also choose first or second half.
- **One type of leave per person per day.** A staff member cannot hold more than one type of leave on the same day. This includes pending requests, approved leave, supervisor-given leave, half-day leave (two half-days of different types are not allowed), and BD / BD-IL. A request or grant that includes a date which already has leave is blocked with a message naming the date; the form shows the clash before submitting. To change the type on a day, the existing leave is edited, withdrawn, or cancelled first. A BD marker on an Off day is not leave and does not block anything.
- **No leave on a day already committed to V duty or a DOS/FDO duty** (the other side of section 5.1's rule). The request or grant is blocked, naming the date and the duty; the duty must be removed first if leave is genuinely needed. Ordinary AM/PM cycle days are unaffected: leave taking someone off their normal AM or PM duty is exactly the point of leave.
- While requesting, staff see live feedback on Available Slot(s) for the chosen dates.
- **Locked dates** cannot be selected by staff.
- Supervisors review requests in a simple **inbox sorted by earliest submitted first**. Each row shows only: **staff name, leave type, dates requested, and time submitted**. The staff notes appear when the request is opened.
- There are **no priority or urgency badges**. Supervisors verify the leave type and judge priority themselves.
- Supervisors approve or reject. A reason is required when rejecting.
- **Slots and approval:** staff can still submit a request when no slots are left, and it is up to the supervisor to deny it. A supervisor **cannot approve** a request unless an extra slot is available on every requested date (a half-day request needs at least 0.5 of a slot). The Approve button is disabled with a message such as "No slot available on [date]" until a slot is freed, for example by editing or cancelling other leave. Reject is always available.
- **Withdrawing:** staff can withdraw their own **pending** request. A withdrawn request leaves the supervisor inbox and shows as Withdrawn in the staff history.
- **Cancelling:** only a supervisor (or Management) can cancel leave that is already approved. Cancelling frees the slot again. In Edit view there are two ways in: click the leave chip, or select the cell (anywhere on it) and open the **Leave** tab, which lists the leave on the selected cells with **Cancel leave** and **Details / edit**. For leave of more than one day, the confirmation offers **the whole leave** or **only the clicked day** (from the chip) / **only the selected days** (from the Leave tab); cancelling only some days removes those days and keeps the rest of the leave as it was, and cancelling every day cancels the leave. The staff member always gets a bell notification saying what was cancelled and, for part of a leave, which days remain (not when they cancel their own). In Staff view, a supervisor opening leave on their own shift is told to switch to Edit view to edit or cancel it. The automatic 0.5 OIL from a DOS/FDO duty is never cancelled this way (remove the duty).
- **Leave on Off days:** staff can request leave on their Off days, and supervisors can set it too. See section 8 for how it is counted.
- Requests have three main statuses: **Pending, Approved, Rejected** (plus Withdrawn when staff withdraw a pending request). Staff can see the status. Only Approved leave affects strength figures and slots.

### 12.4 Leave given by supervisors

- A supervisor (or Management) can give leave directly by selecting a staff member, **specific dates or a date range**, a leave type, and **remarks**.
- This leave is **already approved**. It counts toward Not in Strength immediately and appears on the roster and in the staff member's date details.
- It can be given on **locked dates**.
- The one-type-per-day rule (section 12.3) applies: leave cannot be given on a day where the person already has leave. The V / DOS-FDO rule (section 12.3) applies too: leave cannot be given on a day the person already has that duty. Editing leave onto new dates is checked the same way.
- A supervisor can give leave to **themselves** in Edit view (already approved, no approval needed), and can also **approve their own request** submitted from Staff view. Management does not request or take leave.
- Supervisors can **edit** leave (type, dates, and remarks) and **cancel** it, whether it is approved or still pending. Edits and cancellations update the strength figures immediately.
- The automatic 0.5 OIL that comes with a DOS/FDO duty (section 5.2) is the exception: only its half can change, and it is removed by removing the duty.
- Leave can be set on staff **Off days** too.

### 12.5 Locked dates

- Supervisors (own shift) and Management (any shift, or **all shifts at once**) can **lock dates for events**, from the date details panel that opens when a date is selected.
- When locking a date, the supervisor can add **remarks** explaining why, for example a festive period such as Christmas, or an important meeting on that day. **Balloting** for festive periods is handled **outside the app** for now (a possible future update).
- When anyone selects a locked date, they see that it is a **locked date**, with the **remarks shown in the side panel on the right** detailing why it is locked. This is the same side panel used for leave details.
- Staff cannot request leave on locked dates. Locked dates show a lock marker on the calendar and roster, and are disabled in the staff date picker.
- Supervisors and Management can still give leave on locked dates. Leave that was already approved before the lock is unaffected.
- Locks and their remarks can be edited or removed by the same roles.
- When locking dates (or setting a special event, section 6), the same panel offers the option to **also announce it**: see section 13.1.

### 12.6 Leave taken

On the **My Requests** page (section 11.5), staff and supervisors see how many days of **each** leave type they have taken (approved only), for the current month or the current year, as a **list** (not a grid of tiles). **Every** leave type shows, even one taken zero times, not only the ones actually used. Half/full-day variants of the same type combine into one line (0.5 AL + AL, 0.5 OIL + 1 OIL).

Some types are tracked together against a combined **annual limit**, shown as a progress bar and how many days are left:

| **Group**   | **Codes**  | **Limit** |
|-------------|------------|-----------|
| AL/OL       | AL, OL     | 18        |
| MC          | MC         | 14        |
| OML         | OML        | 3         |
| BD/BD-IL    | BD, BD-IL  | 1 (always, since there is one birthday a year) |

Everything else (MWO, HL, FCL, CSE, OIL, custom types) has **no limit**: it just keeps a running total, as before. A limit is always checked against the **whole year**, whichever period (month or year) the list is currently showing, so switching to "This month" changes the counts shown but never the "left" figure. Colour the remaining figure the same way as Available Slot(s) (section 8): green above 2 left, amber at 1-2, red at 0 or below (over the limit, for example leave given beyond it).

## 13. Notifications

The bell (desktop header and mobile top bar) opens a panel of the viewer's own notifications. So far: a staff member is told when their leave is **approved** or **rejected** (with the reason), and when a **locked date or special event** is set on their shift (section 13.1); clicking one marks it read and opens the relevant page. The badge combines unread notifications with the existing "needs your action" count (pending approvals to review, duty swaps waiting for an answer or approval). Further notification types (roster changes, low-slot alerts, and so on) are a future feature.

### 13.1 Announcements (banner)

When locking dates or setting a special event (sections 6, 12.5), a supervisor or Management can additionally raise it as a **banner** shown at the top of the app.

- **Two independent things happen when a lock or event is set:** every active staff member on the affected shift(s) always gets a **bell notification**; the **banner** is an extra, optional step the person setting it chooses.
- The banner has a **message** and a **start date**: it shows from that date up to and including the locked/event date, then stops on its own. It defaults to today's date and the same wording as the lock's remarks or the event's note, but either can be changed.
- Scope matches who set it: a single shift for a supervisor's lock/event, or **every shift** for a Management lock made with "Lock on all shifts".
- Shown to everyone it applies to, at the **top of the app**, above the header. **Several active announcements combine into one banner** rather than stacking several banners; the combined text **slides left to right**, slowly enough to read in full before it repeats.
- **Closing the banner is per-viewer**: an "X" dismisses it for that person only, and does not remove it for anyone else or for a later viewer whose banner hasn't shown yet.

## 14. Platform and UI requirements

### 14.1 Platforms

- **Desktop-first** web app, with a **full mobile view**.
- **Phone readability rules** (check at 360 and 375 px wide): no text smaller than 11px; nothing is ever stuck under the fixed bottom tabs or the bottom sheet (the roster reserves the sheet's measured height, `--sheet-h`, and other pages pad for the tabs); the page never scrolls sideways (anything wide scrolls inside its own `relative overflow-x-auto` box, so hidden screen-reader labels can't widen the page); chips and tags fit inside their cell or card; and when an element is resized, its neighbours stay visible and it keeps the size and style of comparable controls.
- Mobile uses bottom tab navigation (Roster, Requests, Manage for supervisors and Management, Profile). The Roster tab holds the Calendar and Roster views with the leave request / duty swap form as a bottom sheet over the page, so the dates stay visible while picking; the Requests tab is My Requests (status only, section 11.5), and Manage is Manage requests. Forms use bottom sheets and should work one-handed. The mobile calendar view and roster view are switchable in the same way as on desktop, and the mobile roster is a day-by-day agenda or week-strip view with a shift switcher, not a shrunken desktop table. A **Day / Grid** switch (phones only, Roster view) offers the full month grid as an alternative: it sits in its own screen-high box that scrolls sideways and down, with the date header and name column pinned. The choice is remembered per browser.

### 14.2 Visual style

- Simple, calm, easy on the eyes, and highly readable for dense data. No decorative clutter.
- **Light and dark mode toggle** in the header, with sufficient contrast in both modes.
- Neutral base with one restrained accent colour: a cool slate neutral (deep navy, not black, in dark mode) with an ink-navy accent for primary buttons, the selected shift, today's date and the Edit view switch. No brand identity yet, so use a neutral placeholder logo with the name "PS Tracker".
- Duty colours follow the time of day, lightest in the morning to darkest at night, in both light and dark mode. Every colour is a named token in `app/globals.css`, so the palette is changed in one place.
- Colours, always paired with a text label, an icon, or a legend for accessibility (see "Roster view colour coding" below):

| **Item**          | **Colour**                                |
|-------------------|-------------------------------------------|
| **AM**            | Warm apricot (solid in dark mode too: a see-through warm tone on a dark background reads as brown) |
| **PM**            | Deeper dusk blue                          |
| **V (night)**     | Night indigo                              |
| **Off**           | Soft slate grey                           |
| **Off(V)**        | Light lavender tint with the "Off(V)" label |
| **Leave**         | By group (section 12.1): Annual teal, Health & care rose, Training & growth green, Birthday & in lieu plum, custom neutral slate |
| **DOS/FDO**       | Solid ink tag                             |
| **Duty swap**     | Azure tag with the ⇄ icon                 |
| **Special event** | Magenta accent (used for nothing else)    |
| **V(SB) standby** | Neutral grey dashed outline: standby only, so not the V colour |
| **Locked date**   | Neutral hatch pattern with a lock icon    |
| **Duty on leave (pending)** | Amber (`warning`) tint with a dashed amber outline and a "Pending" tag (section 5.1) |
| **Announcement banner** | Cyan accent, with a megaphone icon  |
| **Status**        | Green = fine / approved, amber = low / pending, red = none left / rejected / error |

**Roster view colour coding.** On the Roster view (desktop grid and mobile day list), **AM, PM, and Off are not written as text**. Each cell is filled with its duty colour instead: AM apricot, PM dusk blue, Off grey. The date header shows the shift's duty as a small colour bar. **V, V(SB) and Off(V) keep a text label** on top of their colour, because they are exceptions to the cycle (Off(V) is a light violet tint with the "Off(V)" chip, not a border). DOS/FDO duties show their name as a small tag. To stay accessible without text:

- A **colour legend** sits **below** the roster grid, pinned so it stays in view while the grid scrolls (on the phone Day list, at the end of the day), naming every colour **by its code, as written on the roster**: AM, PM, V and DOS/FDO are written as just "AM", "PM", "V" and "DOS/FDO", with no timings and no report time, and the leave groups as their codes, **AL/OL**, **MC/OML/MWO/HL/FCL**, **GRW/CSE** and **BD/BD-IL/OIL** (the group's full name is in the tooltip). Times stay in the cell tooltips.
- Each cell has a hover tooltip and a screen-reader label with the duty name and times.
- Leave chips, Task tags, lock icons, and special-event markers still appear on top of the colour. Task and DOS/FDO tags have a near-solid background so they stay readable on every duty colour.

Other screens (Calendar view, side panel, Home, forms) keep text labels for duties.

### 14.3 Switches and toggles

- **Calendar view / Roster view** switch: available to every role, always visible near the top of the roster area.
- **Edit view / Staff view** switch: Supervisors and Management only, clearly distinct from the calendar/roster switch so the two are not confused. Edit controls appear only in Edit view.
- **Side panel collapse**: on desktop, a square panel button at the end of the roster toolbar hides the panel (and shows it again; the tooltip says which), for every role, so the roster can use the full width. On mobile the panel is already a bottom sheet, so this button is desktop-only.
- **One toolbar row:** Shift, month, Calendar / Roster, Compact, Staff / Edit and the panel button sit on a single line on desktop (from about 1280px wide with the panel open, supervisors included), every control the same 32px height and shape, with selected segments in the accent. Narrower screens wrap, keeping Staff / Edit and the panel button together on the right.
- **Day / Grid** switch: phones only, on the Roster view. Day is the one-day list (the default); Grid is the full month grid, scrolled sideways (section 14.1).

### 14.3.1 Navigation, loading and error states

- The requests page is called **My Requests** everywhere (desktop menu, mobile tab, page heading); the review page for supervisors and Management is **Manage requests**.
- The desktop Roster view opens **scrolled to today's column**, not the 1st of the month, so the dates a leave request or duty swap can actually use (today onwards) are visible without scrolling first. The mobile week strip already opens on the week containing today.
- On phones and tablets (where the top menu is hidden), Profile links to every page the role can open.
- Changing month, shift or view shows a thin progress bar and dims the roster until the new data arrives; moving between pages shows a loading indicator.
- A mistyped address shows "Page not found", and a page the role cannot open (for example Tasks for staff) shows "This page isn't available", both with a link back to the roster. If a page fails to load, an error screen offers "Try again".
- Every page has one heading for screen readers, and text colours meet WCAG AA contrast (4.5:1) in light and dark mode.

### 14.4 Hero screens (first design pass)

| **#** | **Screen**                       | **Role / platform**              | **Key content**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
|--------|----------------------------------|----------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1      | Roster view with request panel   | Staff, desktop                   | Shift tabs A/B/C, prominent Calendar / Roster switch, month grid with sticky name column and header. Strength rows directly below the date header (Total, Not in Strength, Working, MFL, Available Slot(s)) with a Compact toggle showing only Available Slot(s). AM / PM / V / V(SB) / Off cells, Task tags, leave chips, locked-date markers; Rest days show MFL blank. Right-hand panel with Request leave / Request swap tabs (dates picked on the grid, or a partner and dates for a swap), and date details. Full request history and leave taken live on My Requests (section 11.5). |
| 2      | Calendar view with request panel | Staff, desktop                   | Month calendar showing each date's duty (AM / PM / Off) and Available Slot(s) at a glance, dots on dates with remarks, lock icons on locked dates. Selecting a range or specific dates highlights them and fills the Request leave form in the right-hand panel; selecting a single date shows leave details and the remark, and for a locked date a "Locked date" badge with its remarks. Leave taken and its limits live on My Requests, not here.                                                                                                          |
| 3      | Calendar with bottom sheet       | Staff, mobile                    | Calendar view with the Calendar / Roster switch and the duty on each date; a half-height bottom sheet (so the calendar stays visible) for the request leave form and date details, including the locked-date badge and remarks.                                                                                                                                                                                                                                                                                                                |
| 4      | Roster view                      | Staff, mobile                    | Week strip or agenda with a shift switcher, strength figures directly under the dates with a Compact toggle, and the request leave bottom sheet.                                                                                                                                                                                                                                                                                                                                                                                               |
| 5      | Edit view roster grid            | Supervisor, desktop              | Edit view / Staff view switch, own shift editable and other shifts "View only", strength rows below the date header with Compact toggle, cells with V, V(SB), Task tags and leave chips, locked dates, special-event markers, right-hand side panel with Edit / Cancel actions for leave. In Staff view the same page shows the request leave form.                                                                                                                                                                                            |
| 6      | Give and edit leave              | Supervisor, desktop              | Drawer or modal: select staff (including themselves), specific dates or date range (Off days allowed), leave type, remarks. Edit mode changes the type, dates, and remarks of existing leave and offers Cancel leave. Shows that the leave is already approved and that locked dates are allowed.                                                                                                                                                                                                                                              |
| 7      | Assign duties and Tasks          | Supervisor, desktop              | Drawer with two parts: duty assignment from one picker (AM, PM, V, V(SB), Off) for selected people and dates, the same way for every duty; and optional Task assignment (pick one Task, select one or more people; one Task per person per day; unavailable for people on full-day leave).                                                                                                                                                                                                                                                     |
| 8      | Lock dates                       | Supervisor, desktop              | Modal with a calendar for selecting dates or a range, a remarks field explaining why the dates are locked, shift scope (own shift for Supervisors; one, several, or all shifts for Management), a list of locked dates with their remarks and edit / unlock actions, and an optional "also announce it" toggle with a message and start date (section 13.1).                                                                                                                                                                                                                                                                       |
| 9      | Leave inbox and review drawer    | Supervisor, desktop              | Requests sorted earliest first showing name, type, dates, time submitted; opening a request shows staff notes and the Available Slot(s) impact. Approve is disabled with a message when a requested date has no available slot; Reject is always available.                                                                                                                                                                                                                                                                                    |
| 10     | All-shift overview               | Management, desktop              | Shifts A, B, C for a selected day or week with strength figures; any duty at or below MFL highlighted; same edit functions as a supervisor.                                                                                                                                                                                                                                                                                                                                                                                                    |
| 11     | Task management                  | Management, desktop              | List of Tasks (Task 1, Task 2, ...) with Add, Rename, and Delete; name only, 6-character counter, and a delete warning that all existing assignments of that Task will be deleted. Not visible to other roles.                                                                                                                                                                                                                                                                                                                                 |
| 12     | Add custom leave type            | Supervisor / Management, desktop | Modal with 6-character limit, live counter, chip preview.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 13     | Swap a duty, from the roster     | Staff / Supervisor, desktop      | Request swap / Swap tab in the roster's side panel: the selected date fills in automatically, pick a partner (same role as you; another shift for AM / PM / Off, the same shift for V / V(SB)) and one or two dates, preview each person's duty before and after, then send (staff) or record (supervisor).                                                                                                                                                                                                                                                                                                                                      |
| 14     | Staff records (`/staff`)         | Supervisor / Management, desktop | List of staff with role and birthday, scoped to the supervisor's own shift or (for Management) a chosen shift's tab; add, edit, and Deactivate/Reactivate. Only Management sees the role and shift fields, and can add a supervisor or move someone between shifts. Below the list, a Task proficiency matrix (people down, Tasks across, sticky name column, scrolls horizontally as Tasks are added) with one click-to-cycle button per cell (not trained / proficient / understudy), never shown to staff; Management can filter the matrix by shift ("All shifts" or one). See sections 9.3 and 11.6. |
| 15     | Task report                      | Supervisor / Management          | Filter by year, month, or date range, and by shift. Summary card per Task (days, people), staff-by-Task table with totals (no per-person date list: the roster has that), "include scheduled" and "hide staff with no Tasks" options. See section 9.2. |
| 16     | Dayworkers                       | Supervisor / Management          | Add a dayworker (name, username with a live 7-character counter), a year / month / date-range filter, and a table of username, name, Ops duty days per shift and in total, with Edit and Deactivate. Opening a row shows the dates. See section 5.3. |
| 17     | My Requests                      | Staff / Supervisor               | Leave taken this month or this year, as a list (every type shown, even at zero; AL/OL, MC, OML and BD/BD-IL show a combined annual limit); every leave request and duty swap the viewer has made, filterable by status. No creation form: request from the Roster. See sections 11.5 and 12.6. |
| 18     | Manage requests                  | Supervisor / Management          | Leave on the left, swaps on the right (needing approval above the shift's full swap history): pending leave, earliest submitted first, with Approve / Reject; duty swaps needing approval and the shift's full swap history, each with an expandable Compare proficiency panel. No creation form: record a swap from the Roster. See sections 9.3 and 11.5. |

If the first generation must be limited, start with screens 1, 2, 3, 5, 6, 7, and 11, then add the rest.

### 14.5 States to show in designs

- Slots at zero, and a duty below MFL.
- Pending, approved, and rejected leave; leave given by a supervisor (already approved).
- Special-event day, V duty block with two V(SB) standby people, and post-V Off.
- A locked date selected, showing the "Locked date" badge and remarks in the right-hand side panel; disabled in the staff date picker; leave can still be given by supervisors.
- Approve disabled because no slot is available, and a pending request with a Withdraw action.
- Off-day leave on a Rest day, with MFL blank and Working Strength and Available Slot(s) equal to Total minus Not in Strength.
- A supervisor editing or cancelling approved leave.
- The Task delete warning shown to Management.
- A date with remarks selected, with the side panel open.
- The Calendar view and the Roster view, and the Edit view and the Staff view for a supervisor.
- A supervisor or staff member viewing another shift (read-only).
- A Task shared by several people, an unassigned person with no Task, and the Task management screen visible to Management only.
- Rest day for a shift on its Off days.
- Strength rows below the dates in full mode and in Compact mode (only Available Slot(s)).
- The request leave form open beside the roster or calendar with dates selected, showing AM / PM / Off for those dates.
- A person on full-day leave with no Task for that day, and a person on half-day leave who keeps their Task.
- A birthday on an Off day, showing BD on the birthday and BD-IL on the next working day.
- A duty swap between two staff, before and after.
- The bottom rows of the roster with several dayworkers stacked in one day, a 7-character username fitting its column, and the full name on hover.
- An Extra person from another shift, and Support and Recall shown as greyed "not active yet" placeholders.
- The Dayworkers page with duty days per shift, including an inactive dayworker.
- A request or grant blocked because the date already has another type of leave.
- A person on V duty with a Task tag.
- The Roster view colour legend, with AM / PM / Off shown by colour only.
- A DOS/FDO duty on an AM day, with its automatic 0.5 OIL on the next day.
- An Off(V) given by a supervisor to an activated V(SB).
- A date selected by a supervisor, showing its lock and special-event settings.
- Available Slot(s) in each colour: green, yellow, and red (none left, and below MFL).
- The Task report filtered by year, by month, and by a date range.

### 14.6 Sample data

For now, use placeholder staff names that are each a **single 5-character word** (for example Alpha, Bravo, Delta, Eagle, Frost, Grace, Haven, Ivory, Jolly, Karma). Do not use realistic personal names. Names may repeat across different shifts. Dayworker sample data follows the same rule for names (for example Comet, Sable, Torch), with short usernames such as CMT or SBL, and one using the full 7 characters. Seed data starts with **12 Tasks** ("Task 1" to "Task 12"), with sample Task proficiency (including some understudies) across the seeded staff.

## 15. Out of scope

- Payroll.
- Timesheets and clock-in / attendance.
- HR records.
- Balloting for festive periods (handled outside the app for now; possible future update).

## 16. Assumptions and open items

### Assumptions made so far

- Shifts A, B, and C are fixed groups of people, and all members of a shift move through the cycle together, except for individuals temporarily on V duty.
- Weekend means Saturday and Sunday for the purpose of weekday/weekend MFL values.
- Strength figures are visible when viewing other shifts, since their rosters are viewable.
- Supervisors can approve their own requests from Staff view and can give themselves leave in Edit view (no approval needed). Management does not request or take leave.
- Tasks are assigned per person per day (or date range), one Task per person per day (people on V duty included), and do not affect scheduling, leave, strength, or leave slots.
- A person holds at most one type of leave per day (section 12.3).

### Open items

- BD / BD-IL: whether they are given automatically or requested, whether they need an available slot, and whether the BD-IL day can be moved.
- Duty swaps: whether staff may request a swap on a locked date (currently allowed), whether a swap needs an extra slot or MFL check (currently no, since it is one for one), and whether a V taken over in a swap should earn Off(V) on the taker's next PM block when the V did not fall on the taker's Off days (currently yes). When staff records can move people between shifts, decide what happens to their pending and approved swaps (a swap stores each person's shift when it was made).
- Staff records: which details are kept (for example name, shift, role, birthday).
- V(SB): how a standby person's own cycle looks around their standby day (for example, which days they are normally on, and whether their following block changes).
- Whether the "extra slot needed" rule for approval also applies to leave a supervisor gives directly, to a supervisor's own leave, and to edits of existing leave.
- Where leave entitlements come from, so "leave taken" (section 12.6) could one day also show how many of each type remain.
- Branding: final app name, logo, and accent colour.
- Notification design and rules (future).
- Tasks on non-working days: whether a Task may be assigned on an Off day or on a V(SB) standby day (currently allowed; only full-day leave blocks a Task).
- BD on a working-day birthday that already has other leave: currently treated like an Off-day birthday (BD marker, BD-IL on the next free working day). To confirm.
- Colour-only duties on the Roster view: confirm the legend and tooltips are enough for colour-blind users, or add a pattern for AM vs PM.
- Task report: whether supervisors should see other shifts' Task counts (currently yes, like the roster), and whether an export (for example CSV) is needed.
- Whether half-day leave should also block a duty on that day, or only full-day leave (the app currently blocks any leave).
- Whether AM or PM should ever be editable by hand (for example to fix a mistake), now that the picker only offers V, V(SB) and Off(V).
- Whether a DOS/FDO duty should count anywhere in the strength figures.
- Dayworkers: whether Ops duty needs actual clock times rather than a count of days. (Decided for now: supervisors assign dayworkers, dayworkers do not apply, and they have no accounts. Revisit later if dayworkers should ever sign in.)
- Ops duty: whether a dayworker may clock more than one shift on the same day (now one), and whether Ops duty is allowed on any day or only on a shift's working days (now any day).
- Support (AM/PM) and Recall: what they mean, who can be put there, and whether they affect strength. They are placeholders until decided.
- Extra shift duty: whether the person should also show on their own shift's roster, whether leave given later on an Extra day should be blocked, and whether Extra people count toward the host shift's Working Strength.
- [Add further open items here.]

# Part B: Build framework

## 17. Tech stack, structure, and conventions

This part covers how the app is built. Part A says how it should behave. It was previously a separate file, `docs/framework.md`. No deployment is needed yet: the app is built and run locally for a hackathon demo.

### 17.1 Tech stack

- **Framework:** Next.js (App Router), TypeScript.
- **Database:** SQLite (single local file, zero setup), via Prisma with the `better-sqlite3` driver adapter.
- **Styling:** Tailwind CSS.
- **Components:** shadcn/ui (Radix + Tailwind, copied into the repo under `components/ui`, not a black-box dependency).
- **Auth:** simple session-based demo auth. A seeded set of demo users (Management, and a Supervisor and Regular Staff per shift) is selectable from a login screen. No passwords in the demo.
- **Backend:** no separate backend service. Server Actions inside the same Next.js project are the backend; Prisma is the data access layer; SQLite is storage.

Do not introduce Postgres, Vercel-specific features, Firebase, or a separate Express server unless explicitly asked. The point of this stack is one project, zero external services, and an easy local `npm run dev`.

### 17.2 Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies and generate the Prisma client |
| `npm run setup` | Create `prisma/dev.db` and seed demo data |
| `npm run dev` | Start the dev server on http://localhost:3000. A phone on the same network opens the "Network" address it prints; that network must be listed in `allowedDevOrigins` in `next.config.ts` (a phone hotspot `172.20.10.*` and `10.130.1.*` are), or the page loads without working buttons or live updates. Restart after changing it |
| `npm test` | Unit tests for the cycle, V overlay, strength, and birthday rules |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run db:seed` | Wipe and reseed demo data around the current month |
| `npm run db:migrate` | Create and apply a migration after changing `prisma/schema.prisma` |

### 17.3 Project structure

```
/app
  /login                    demo login
  /(app)/roster             Calendar / Roster views, same-page request panel, date settings
                            (lock, special event), Duty / Task / Leave / Swap (Edit view),
                            Request leave / Request swap (Staff view)
                            (Edit / Staff is a switch on this page: ?mode=edit)
  /(app)/requests           My Requests: leave taken, and every leave request / duty swap with
                            its status (view only; mobile Requests tab; section 11.5)
  /(app)/manage-requests    Manage requests: leave inbox, swap approvals (view / review only;
                            supervisor / management; mobile Manage tab; section 11.5)
  /(app)/task-report        Task report (supervisor / management), section 9.2
  /(app)/dayworkers         dayworkers and their Ops duty counts (supervisor / management), section 5.3
  /(app)/tasks              Task management (management only)
  /(app)/staff              Staff records and Task proficiency (supervisor / management), section 11.6
  /(app)/profile            profile, theme, links to Tasks, the Task report, and Staff on mobile
  actions.ts                all Server Actions: requestLeave, approveLeave, giveLeave, assignDuty, assignTask,
                            lockDates, setSpecialEvent (with the optional announce banner), ...
  swap-actions.ts           duty swap Server Actions
  staff-actions.ts          staff record Server Actions (create / update / deactivate, Task proficiency)
  announcement-actions.ts   closing the announcement banner (per viewer)
/components/ui              shadcn/ui components
/components/roster          RosterGrid, CalendarView, MobileRoster, SidePanel (incl. the roster's
                            Request swap / Swap tabs, and the lock/event date-settings panel with its
                            optional announce fields), chips and legend
/components/tasks           Task manager, Task report filters and table
/components/requests        LeaveInbox: the pending-leave review list on Manage requests
/components/swaps           swap request / record form (with preview) and swap list (incl. the
                            Compare proficiency panel on Manage requests): the form is used from the
                            roster, the list from My Requests and Manage requests
/components/staff           StaffManager: add / edit / deactivate staff, and the Task proficiency matrix
/components/announcements   AnnouncementBanner: the combined, sliding, per-viewer-dismissible banner
/lib
  cycle.ts                  duty cycle, cycle position, V overlay and Off (post-V)
  swaps.ts                  duty swap exchange and preview (pure); swap-data.ts loads and checks swaps
  dos-oil.ts                the automatic 0.5 OIL after a DOS/FDO duty
  strength.ts               Total / Not in / Working / MFL / Available Slot(s)
  birthday.ts                BD / BD-IL placement
  leave-rules.ts            one type of leave per person per day
  leave-report.ts           tally of approved leave taken, by type, for My Requests
  permissions.ts            role and shift access checks
  roster-data.ts            loads a shift's dates and computes cells and strength rows; getPendingLeaves
                            for the Manage requests inbox
  task-report.ts            Task report counts
  dayworkers.ts             dayworker username rules (max 7, capitals), report row type
  dayworker-report.ts       Ops duty counts per dayworker
  report-period.ts          the year / month / date-range filter shared by both reports
  staff.ts                  staff name / role normalisation
  proficiency.ts            Task proficiency map and per-swap comparison summaries
  notifications.ts          the bell: leave decisions, and locked-date / special-event notices
  announcements.ts          active announcements for a viewer, and dismissing them
/prisma
  schema.prisma
  seed.ts                   3 shifts, demo staff and users, duties, V blocks, leave, 12 Tasks with sample
                            proficiency, locks, events, and their announcements
/docs
  system-context.md         this document
```

### 17.4 Build conventions

- **Derive, don't store:** strength figures, cycle position, duty-on-a-date, Off (post-V), and BD / BD-IL are always computed (in `/lib`), never stored as their own columns. Supervisor changes to a duty are stored as a per-day override.
- **One duty picker:** AM, PM, V, V(SB), and Off are the same kind of duty. Do not build separate code paths or UI for V / V(SB).
- **Server Actions over a separate API layer:** mutations are Server Actions, not a REST or GraphQL API.
- **Permission checks live in one place:** `/lib/permissions.ts` is called from the UI (to hide controls) and from every Server Action (to enforce them). Never rely on a hidden button as the only protection.
- **Leave rules live in one place:** the one-type-per-day check (`/lib/leave-rules.ts`) runs in every action that creates or moves leave, and the UI shows the clash before submitting.
- **Seed realistic-shaped data:** the seed creates 3 shifts, staff with placeholder 5-character names, and enough duties, V blocks, leave, and Tasks that the app looks populated on first run.
- **Flag, don't guess:** if behaviour is not fully specified (see section 16), implement the most reasonable interpretation and leave a `// TODO(open item):` comment rather than silently deciding.
- **Every browser, not just Chrome.** Supported: current Chrome and Edge, Safari (macOS and iOS) 16.4+, and Firefox 128+ (the baseline Tailwind CSS v4 itself needs). Check new UI in Firefox and WebKit as well as Chromium; Playwright's `firefox` and `webkit` browsers do this on Windows too. Known traps:
  - No `<input type="month">` or `type="week"`: desktop Firefox and Safari show a plain text box. Use `components/month-picker.tsx` (month and year selects). `type="date"` is fine.
  - A `<summary>` styled as a button needs `[&::-webkit-details-marker]:hidden` as well as `list-none`, or Safari shows a disclosure triangle.
  - `:has()` only as an enhancement with a fallback (Firefox before 121 lacks it). The announcement banner's height, for example, is set by `:has()` in CSS and also from JavaScript.
  - `field-sizing` (auto-growing text areas) is Chromium-only; the fixed-height fallback must still be usable.
  - Avoid browser-specific JavaScript (`requestIdleCallback`, `showPicker`, `navigator.userAgentData`) without a fallback.

### 17.5 Colour tokens (read before designing any new UI)

The product rules for colour are in section 14.2; this is how they are built, so new screens and components fit the existing scheme.

**Where colours live.** Every colour is a CSS variable in `app/globals.css`, defined twice: under `:root` (light) and `.dark` (dark). Each is registered in the `@theme inline` block, which makes it a Tailwind utility: `--am` becomes `bg-am`, `text-am`, `border-am`, and opacity modifiers work (`border-danger/40`). Because the variable itself switches with the theme, **components never need `dark:` colour variants**.

**Rules.**

- **Use tokens, never raw Tailwind palette colours** (`bg-red-100`, `text-emerald-700`, `bg-yellow-300` ...). If no token fits, add one (below) rather than hard-coding.
- **Reuse the shared pieces** in `components/roster/chips.tsx` instead of restyling: `DUTY_CELL` / `DutyChip` for duties, `LeaveChip` for leave, `StatusBadge` / `SlotBadge` / `SLOT_STYLE` / `SLOT_BG` for statuses, `DosTag`, `SwapTag`, `TaskTag`, `LockBadge`, `EventBadge`, `OpsChip`, `ExtraChip`.
- **Colour is never the only signal:** pair it with text, an icon, or the legend (`DutyLegend`, shown below the roster grid). Anything new with its own colour on the roster goes in the legend.
- **Text contrast at least 4.5:1 in both themes.** Anything drawn on top of a roster cell (a tag or chip) needs a near-solid background, because it can land on any duty colour.
- **Reserved meanings: don't reuse these for anything else.** Magenta (`event`) = special events only. Red (`danger`, `destructive`) = errors, no slots or below MFL, rejected, and destructive actions; never a category. Amber (`warning`) = low slots, pending, cautions. Green (`success`) = fine, approved, done. Ink navy (`primary`) = the one accent: primary buttons, the selected tab, today, the Edit view switch, DOS/FDO tags.

**Token families.** Most families come as a set: the base (solid fill, borders, bars, dots), `-soft` (a pale panel or badge background), and `-ink` (text on the soft fill).

| **Family** | **Tokens** | **Use** |
|---|---|---|
| Neutral base | `background`, `foreground`, `card`, `muted`, `muted-foreground`, `secondary`, `accent`, `border`, `input`, `ring` | Page, surfaces, quiet text, dividers (shadcn/ui names). Cool slate, not pure grey. |
| Accent | `primary`, `primary-foreground` | The one accent, ink navy (light periwinkle in dark mode). |
| Duties | `am`, `am-edge`, `am-ink` · `pm`, `pm-edge`, `pm-ink` · `night`, `night-strong`, `night-ink` · `offv`, `offv-ink` · `off`, `off-edge`, `off-ink` · `standby`, `standby-edge`, `standby-ink` | Time of day, light to dark: AM warm apricot, PM dusk blue, V night indigo. Off slate, Off(V) lavender, V(SB) neutral dashed. |
| Leave groups | `leave-annual`, `leave-medical`, `leave-growth`, `leave-inlieu`, `leave-custom` (each with `-soft`, `-ink`), and `leave-on` (text on a solid chip) | Picked by `leaveGroup(code)` in `lib/domain.ts`. A chip sets `data-leave={group}`, which sets `--chip`, `--chip-soft` and `--chip-ink`; style it with `bg-(--chip)` and so on, and use `.leave-half` for half-day. A new leave type goes in `LEAVE_GROUP_BY_BASE_CODE`, not a new colour. |
| Status | `success`, `warning`, `danger` (+ `-soft`, `-ink`) | Messages, badges, slot figures, limit bars. |
| Markers | `info` (announcements, dayworker Ops chips), `event` (special events), `swap` (duty swaps), `extra` (Extra duty) (+ `-soft`, `-ink`) | One meaning each. |
| Other | `--hatch` via `.bg-hatch` | Locked dates. |

**Recipes.**

- Message or panel: `rounded-md bg-danger-soft p-2 text-xs text-danger-ink` (swap `danger` for `warning`, `success`, `info`).
- Outlined box: `border border-success/40`.
- Badge: `bg-warning-soft text-warning-ink` (see `StatusBadge`).
- Solid fill with text: `bg-success text-white dark:text-background` (the solid gets lighter in dark mode, so its text flips dark).
- Tag on a roster cell: soft or solid background plus a border, never transparent (see `SwapTag`, `TaskTag`).

**Hue map** (OKLCH hue, to avoid a new colour looking like an existing one): danger 27 · extra 50 · AM 74 / warning 75 to 85 · growth 145 · success 160 · annual 195 · info 215 · swap 240 · PM 255 · accent and neutrals 255 to 262 (low chroma) · V / Off(V) 285 to 292 · in lieu 305 · event 340 · medical 5. Siblings share a lightness: the leave groups are all about L 0.53 in light mode and L 0.74 in dark mode, so no chip is louder than another.

**Adding a colour.** Add the variable to both `:root` and `.dark` in `app/globals.css`, register it in `@theme inline` (`--color-name: var(--name);`), give it a hue that is free on the map above, check contrast in both themes, and add a row to this section (and to section 14.2 if it carries product meaning).

### 17.6 Build priority

Done: Roster view and same-page leave request (staff), Calendar view, Edit view roster grid (supervisor), give / edit / cancel leave, approve / reject from the leave detail panel, assign duties (V, V(SB), Off(V), DOS/FDO) and Tasks, lock dates and special events (with the optional announcement banner), Task management (management), Task proficiency, the Task report, dayworkers with Ops duty and their count, Extra shift duty, the Support and Recall placeholder rows, duty swaps (including picking one directly from the roster, and comparing proficiency when reviewing one), the My Requests / Manage requests pages, staff records, and notifications for leave decisions and shift announcements.

Next: the all-shift overview and custom leave types. See section 14.4 for the full hero-screen list.

## Appendix: Claude Design prompt

This is the prompt prepared for generating the first UI mockups. It condenses the sections above. Paste it into Claude Design and edit as needed.

Design polished **hero screens** for a responsive web app (desktop and mobile) called **PS Tracker**, a duty roster management system for a shift-based team. There are three roles: Regular Staff, Supervisor, and Management.

**Shifts and cycle:** Staff belong to three fixed shifts, Shift A, Shift B, and Shift C, of 20-30 people each. All shifts follow the same 6-day cycle of 2 PM, 2 AM, 2 Off, offset so that handover runs A to B to C to A. On any given day one shift is on PM, one is on AM, and one is resting. Make the rotation easy to read and show each person's cycle position (for example "1st PM, next: AM").

**Duties and timings:** The daily duties are AM (0745-1445), PM (1445-2130), V (the night shift, 2130-0745, crossing midnight), V(SB) (standby for V), and Off. A supervisor assigns V, V(SB) and Off(V) from one duty picker, and can reset a day to the cycle; AM and PM always come from the cycle. A separate DOS/FDO duty (named DOS, DOS2IC or FDO) sits on top of an AM day: 24 hours reporting at 0800, the Task is kept, and a 0.5 OIL (first half) follows automatically the next day.

**V duty and standby:** Normally 1 person covers V; specific dates can require more. The person works 2 days of V on what would be their 2 Off days after AM, then their next 2-day PM block becomes 2 Off, then they continue normally. Example: PM PM AM AM V V OFF OFF AM AM OFF OFF PM PM. Label the converted Off days "Off (post-V)". For the 2-day V block, one person from the same shift is on V(SB) for both V nights. V(SB) does not affect strength, MFL, or leave slots.

**Special events:** Some dates carry a note for the whole shift. Show a clear "Special Event" indicator with its note on the day header, day view, mobile day card, and affected cells. There is no reporting time, and special events do not change MFL or leave slots. Public holidays do not affect MFL or duty.

**Minimum headcount (MFL):** Weekday: AM 13, PM 12, V 1. Weekend: AM 14, PM 11, V 1. V MFL is always 1.

**Strength figures (each duty, per day):** Total Strength (everyone in the shift); Not in Strength (people out on approved leave or other absence); Working Strength (Total minus Not in Strength); Available Slot(s) (Total minus Not in Strength minus MFL). Only approved leave counts. Half-day leave (0.5 AL, 0.5 OIL) counts as 0.5, so values like 21.5 must display cleanly. Colour-code Available Slot(s): green above 2 left, yellow at 1-2 left, red at none left ("No slots") or below MFL. A shift on its Off days shows a "Rest day" state: MFL is left blank, Not in Strength still counts people on leave, and Working Strength and Available Slot(s) are both Total minus Not in Strength. **Placement:** put Total Strength, Not in Strength, Working Strength, MFL, and Available Slot(s) in sticky rows **directly below the date header** so they stay visible while scrolling. Provide a **toggle** (for example "Compact") that minimises the strength counts and MFL and shows only Available Slot(s).

**Regular Staff view:** Staff can see the roster of all shifts to plan their schedules. Provide two views, a **Calendar view** and a **Roster view**, with a clearly visible **switch button** to toggle. The **request leave form sits on the same page** as these views (in a right-hand panel on desktop, a bottom sheet on mobile) so staff can see the dates they want, whether each date is AM, PM, or Off, and what has already been planned while booking. Staff pick a **date range or specific dates** directly on the calendar or roster, choose a leave type, and add **additional notes** for the supervisor. When a staff member selects a date that has remarks, show the leave details (type, dates, status) and the remark in the side panel. They can see whether each request is Pending, Approved, or Rejected in the same panel. Staff can request leave on any day, including their Off days, and can still submit when no slots are left (the supervisor decides). They can **withdraw** a pending request but cannot cancel approved leave. Some dates are **locked** for events, and staff cannot apply for leave on locked dates (show a lock icon and disable them in the date picker). When someone selects a locked date, show that it is a **locked date** and show the **remarks** explaining why in the side panel on the right (for example a festive period or an important meeting). Show BD on the roster and calendar on a staff member's birthday. A **Request swap** tab sits next to the leave request tab, on the same page: partner (always a **different** shift, never the same one) and one or two dates, with a before/after preview. Leave taken, and the status of every request and swap, live on the **My Requests** page. Staff have no edit controls.

**Supervisor view:** Supervisors are part of the roster, so they also get the regular staff view, plus an **Edit view**. Provide a prominent **switch button** between **Edit view** and **Staff view** (distinct from the Calendar/Roster switch). In **Staff view** a supervisor can submit leave requests like regular staff and can approve their own request. In **Edit view** they manage only their own shift (other shifts are read-only) and can: assign duties (AM, PM, V, V(SB), Off) from one duty picker; **swap duties** between staff, only with someone of the **same role** (staff with staff, supervisors with supervisors), from a **Swap** tab alongside Duty / Task / Leave, on the same page as the roster — selecting a date, or a person's cell, fills in the date automatically; assign Tasks (optional, one Task per person per day, not for people on full-day leave); **give leave** to staff, **including themselves**, by selecting specific dates or a date range, a leave type, and remarks (leave they give is already approved, so it has no approval step); **edit leave** and its remarks, and **cancel approved leave** (only supervisors and Management can cancel approved leave); set leave on Off days; approve or **reject pending** staff leave requests (reason required on reject; Approve is disabled unless an extra slot is available on every requested date, and Reject is always available); **lock dates** for events and add remarks explaining why (for example a festive period or an important meeting); set special events; and add custom leave types. Supervisors can give leave on locked dates.

**Management view:** Management can do everything a Supervisor can do across all shifts, but does **not** request or take leave of any sort (no request form, no "my requests"). Their role is the bigger picture of roster and duty management, so give them a strong all-shift overview. Management can also **rename, add, and delete Tasks**, lock dates for all shifts at once, and **manage staff records** (add staff, edit details such as birthday, move people between shifts). Deleting a Task deletes all of its existing assignments, so show a clear warning before deleting. Tasks need no description, only a name.

**Common leave types:** AL (local leave), 0.5 AL (half-day local leave), OL (overseas leave), MWO (mental wellness off), OML (ordinary medical leave, that is MC without a medical certificate), MC (medical leave), HL (hospitalised leave), FCL (family care leave), CSE (course leave), BD (birthday leave), BD-IL (birthday off in lieu), 0.5 OIL (half-day off in lieu), and 1 OIL (off in lieu). For 0.5 AL and 0.5 OIL the requester picks first half or second half of the duty, showing actual hours. **Birthdays:** BD is shown on the roster and calendar on the staff member's birthday, even when it falls on an Off day. In that case the leave becomes BD-IL, placed on the next closest working day they have. Supervisors can add a custom leave type with a name of maximum 6 characters, spaces included, with a live counter (for example "4/6"), validation, and a chip preview. Custom types count toward Not in Strength like the common types. Each type is a short-code chip; half-day types are half-filled.

**Leave inbox (supervisor), on the Manage requests page:** a simple list sorted by earliest submitted first. Each row shows only staff name, leave type, dates requested, and time submitted, plus Approve and Reject. Approve is disabled with a message like "No slot available on [date]" when a requested date has no available slot. Staff notes appear when a request is opened, together with the resulting Available Slot(s) for those dates. No priority badges.

**Tasks:** Specific duties named Task 1, Task 2, Task 3 and so on, with a name limit of 6 characters including spaces (live counter in the form). Assignment is optional, and people on V duty can be given a Task. A person holds only one Task per day, and a person on full-day leave has no Task for that day (half-day leave keeps the Task). Two or more people can share the same Task. Tasks are purely informational and show what people are doing for that duty. Show the Task as a separate small tag on the roster cell that reads simply "Task 2", next to (never replacing) the duty. Tasks do not conflict with scheduling and do not affect leave, strength, MFL, or leave slots.

**Task report (supervisor and Management):** filter by year, month, or date range and by shift; a summary card per Task, then a staff-by-Task table of days done with totals, and options to include scheduled Tasks and hide staff with no Tasks. It must stay readable when there are many Tasks.

**Dayworkers and bottom rows:** Dayworkers are office staff (normally 8 to 5) outside the shift crew who clock shift duty. Supervisors and Management add them with a name and a username of at most 7 characters, shown in capitals. The roster has four rows at the very bottom, in this order: SUPPORT (AM/PM), EXTRA, RECALL, OPS DUTY; the strength rows and Available Slot(s) stay under the date header. OPS DUTY shows the usernames of the dayworkers clocking that day (several can share a day, so names stack and the row grows); hovering a username shows the full name to every user. EXTRA shows people from other shifts serving extra duty, never from the shift itself. SUPPORT and RECALL are visual placeholders only, greyed as not active yet. Supervisors and Management also get a Dayworkers page with how many times each dayworker did shift duty, filtered by year, month, or date range. The colour legend above the roster names each colour without timings.

**One leave per day:** a person can hold only one type of leave on a day (including pending requests, half-days, and BD / BD-IL). Show the clash in the form and block submitting.

**Hero screens:** Staff: (1) desktop Roster view with the request leave panel on the same page, strength rows below the dates with the Compact toggle, and the Calendar/Roster switch; (2) desktop Calendar view with the request panel and date details (leave details and locked-date remarks) on the right; (3) mobile calendar with a bottom sheet for the request form and date details; (4) mobile Roster view with compact strength figures and the request sheet. Supervisor: (5) desktop Edit view roster grid with the Edit/Staff switch and strength rows below the dates; (6) Give and edit leave form (including for themselves); (7) Assign duties (one picker for AM, PM, V, V(SB), Off) and optional Task assignment; (8) Lock dates modal with a remarks field; (9) leave inbox and review drawer; (13) Manage requests, with the leave inbox, swap approvals, and the record-a-swap form. Management: (10) all-shift overview; (11) Task management screen with add, rename, and delete, including the delete warning; (14) Staff records screen. Also (12) the add custom leave type modal; (15) My Requests, with leave taken and pending requests/swaps. If a limit is needed, prioritise screens 1, 2, 3, 5, 6, 7, and 11.

**Navigation and notifications:** Mobile uses bottom tabs (Roster, Requests, Manage for supervisors and Management, Profile); the Roster tab holds the Calendar and Roster views with the request sheet, Requests is My Requests, and Manage is Manage requests. The notification bell (desktop header and mobile top bar) opens a panel of the viewer's own notifications (section 13); on mobile, Profile links to every other page the role can open, including Staff.

**Style and theme:** Simple, calm, easy on the eyes, highly readable for dense data. Provide a light and dark mode toggle and show key screens in both. Neutral base, one restrained accent colour, generous spacing, no clutter. Suggested colours: AM yellow, PM blue, V purple, V(SB) a neutral grey dashed outline (standby, not duty), Off soft grey, Leave teal, Special Event magenta, locked dates with a hatch pattern and lock icon. On the Roster view, show AM, PM and Off by cell colour only (no text) with a colour legend above the grid; V and V(SB) keep their text labels. Elsewhere pair colours with text labels. Use a neutral placeholder logo with the name "PS Tracker".

**States to show:** slots at zero, a duty below MFL, pending/approved/rejected leave, supervisor-given leave (already approved), special-event day, V block with two V(SB) standby people and post-V Off, locked dates (a selected locked date showing a "Locked date" badge and remarks in the right side panel, disabled in the staff picker, allowed for supervisors), the request form open beside the roster or calendar with dates selected, strength rows in full and Compact mode, Approve disabled when no slot is available, a pending request with a Withdraw action, Off-day leave on a Rest day with MFL blank, a supervisor editing or cancelling leave, Calendar vs Roster view, Edit vs Staff view, a person with no Task, a Task shared by several people, a person on full-day leave with no Task, a person on half-day leave who keeps their Task, a birthday on an Off day (BD on the birthday, BD-IL on the next working day), a duty swap before and after, another shift viewed read-only, the Task delete warning, and the Task management screen visible to Management only.

**Sample data:** placeholder staff names that are each a single 5-character word (for example Alpha, Bravo, Delta, Eagle, Frost, Grace, Haven, Ivory, Jolly, Karma). No realistic personal names.

**Out of scope:** payroll, timesheets, clock-in/attendance, HR records, and balloting for festive periods (handled outside the app for now).
