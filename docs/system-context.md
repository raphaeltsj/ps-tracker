# PS Tracker: System Context Document

*Duty roster management for a shift-based team | Version 1.6 | Draft for editing*

## 1. Purpose of this document

This document describes how the PS Tracker duty roster system is meant to work: the shifts, the duty cycle, the staffing rules, the user roles, and the UI expectations. It is written so that a person, or an AI assistant such as Claude, can read it and understand the system without any other background. Use it as the reference when designing UI mockups, writing specifications, or building features.

It has two parts:

- **Part A: Product rules** (sections 2 to 16): how the system should behave.
- **Part B: Build framework** (section 17): the tech stack, project structure, and build conventions. Read both before implementing any feature.

> **How to edit:** items in [square brackets] are still undecided. Section 16 lists assumptions and open questions. Update this document whenever a rule changes so it stays the single source of truth.

**Changes in 1.6:** one type of leave per person per day (12.3); AM, PM and Off are colour-coded without text on the Roster view (14.2); Tasks can be assigned to people on V duty (9); new Task report for supervisors and Management (9.2); the build framework (previously `docs/framework.md`) is merged in as section 17.

# Part A: Product rules

## 2. System overview

PS Tracker is a web application (desktop-first, with a full mobile view) that manages a duty roster for a team working a fixed rotating shift system. Its main jobs are:

- Show who is working which duty (AM, PM, V) or is off on any day, for every shift.
- Let regular staff view every shift roster (calendar view or roster view) and request leave with notes, and let supervisors approve or reject requests or give leave directly.
- Track staffing levels against a minimum requirement (MFL) so supervisors can see how many people can still take leave.
- Handle exceptions: V (night) duty with standby people, special-event reporting times, locked leave dates, duty swaps handled by supervisors, and custom leave types.
- Let management maintain the list of Tasks and let supervisors optionally assign them to their shift.

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

Each staff member should be able to see their position in the cycle (for example "PM Day 1 of 2, next: AM").

## 4. Duty timings

| **Duty**      | **Default time** | **Notes**                                                       |
|---------------|------------------|-----------------------------------------------------------------|
| **AM**        | 0745 - 1445      |                                                                 |
| **PM**        | 1445 - 2130      |                                                                 |
| **V (night)** | 2130 - 0745      | The night shift, written as V. Crosses midnight. See section 5. |

## 5. V duty (night shift)

The night shift is written as **V**. V duty is a **temporary overlay on the normal cycle**, not a separate team. Normally **1 person** covers V. On specific dates more than 1 person may be needed, and the supervisor sets the number for that date.

A person assigned to V duty follows this rule:

- They work **2 days of V on what would have been their 2 Off days after AM**.
- Their following 2-day PM block is then **replaced by 2 days Off**.
- They then continue with 2 days AM, 2 days Off, and return to the normal cycle.

Example for a person in Shift A (compare with the normal cycle in section 3.2):

| **Day**    | **1** | **2** | **3** | **4** | **5** | **6** | **7** | **8** | **9** | **10** | **11** | **12** |
|------------|-------|-------|-------|-------|-------|-------|-------|-------|-------|--------|--------|--------|
| **Normal** | PM    | PM    | AM    | AM    | OFF   | OFF   | PM    | PM    | AM    | AM     | OFF    | OFF    |
| **With V** | PM    | PM    | AM    | AM    | V     | V     | OFF\* | OFF\* | AM    | AM     | OFF    | OFF    |

V = night duty. OFF\* = Off that replaces the PM block after V duty. The UI should label these as "Off (post-V)" so they are visibly different from regular Off days.

### 5.1 V and V(SB) are duties

V and V(SB) are **duty types**, just like AM, PM, and Off. A supervisor assigns V or V(SB) to a staff member in **exactly the same way** as any other duty: pick the person, the date(s), and the duty from the same duty picker (AM, PM, V, V(SB), Off).

V duty runs for **2 days**, and each of those days has a **standby person** on **V(SB)**. Standby people come from **within the same shift** as the person on V duty.

- **One person** is on V(SB) for the **first** V day.
- A **different person** is on V(SB) for the **second** V day.
- On the roster, a standby person's cell for that day reads "V(SB)", so it is clearly different from a person actually working V.
- V(SB) does **not** affect Total Strength, Not in Strength, Working Strength, MFL, or leave slots.
- Supervisors (own shift) and Management (any shift) assign V and V(SB) from the duty picker.

## 6. Special events

On some dates an entire shift must report at a different time, earlier, later, longer, or shorter than the default timings. This is called a **special event**.

- The UI must show a clear indicator such as "Special Event: report at [time]" on the day header, the day view, the mobile day card, and the affected staff cells.
- Special events **do not change MFL or leave slots** for that day. They only change the reporting time.
- Supervisors can set a special-event time for their own shift.

**Public holidays** do not affect MFL or duty. The team works as usual, so they need no special handling in the roster.

## 7. Minimum headcount (MFL)

MFL is the minimum number of people who must be working a duty on a given day.

| **Duty** | **Weekday MFL** | **Weekend MFL** |
|----------|-----------------|-----------------|
| **AM**   | 13              | 14              |
| **PM**   | 12              | 11              |
| **V**    | 1               | 1               |

- V MFL is normally 1 but can be raised for specific dates by the supervisor.
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
- Available Slot(s) should be colour-coded: healthy, low (1-2 left), zero ("No slots"), and below MFL (warning).

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

## 9. Specific duties (Tasks)

Besides their daily duty (AM, PM, V, V(SB), or Off), staff can be given a **specific duty** that shows what they are doing during that duty. To avoid confusion with the duty types, this document calls them **Tasks**.

- Tasks are named **Task 1, Task 2, Task 3**, and so on. There is a variety of them. Only the **name** is stored: a Task has **no description** and no other details.
- A Task name is limited to **6 characters maximum, spaces included**, with a live counter (for example "6/6"). "Task 1" to "Task 9" fit exactly. From the tenth Task, "Task 10" is 7 characters, so Management renames it (for example "T10").
- **Only Management** can **add**, **rename**, and **delete** Tasks.
- **Task assignment is optional.** Supervisors can assign Tasks to people in their own shift, but nobody is required to have a Task.
- **People on V duty can be given a Task** for their V days, in the same way as people on AM or PM.
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
- **Layout:** a summary card per Task (days and number of people), then a table of staff (rows) by Task (columns) with a total per person and per Task. Opening a person shows the dates for each Task. A tick box hides staff with no Tasks in the period.
- **Many Tasks:** the report must stay readable when there are many Tasks (and many staff).
  - A **Tasks filter** (searchable checklist with Select all / Clear) picks which Tasks become columns.
  - Tasks nobody did in the period are **hidden by default** (a tick box shows them), and the page says how many were hidden.
  - The summary cards are a single **horizontal strip**, busiest Task first, so they never push the table down.
  - The table scrolls inside its own frame with the **header row, Staff column, Total column, and totals row pinned**, so names and totals stay visible while scrolling across many Task columns. A person's expanded date list is height-limited.
- The report counts **Task assignments only**. It does not change duty, leave, strength, MFL, or slots. A deleted Task and its assignments no longer appear.
- Regular Staff do not see the report.

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
| **Swap duties between staff**             | No                | Own shift only          | All shifts                 |
| **Manage staff records**                  | No                | No                      | Yes                        |
| **Set special-event times**               | No                | Own shift only          | All shifts                 |
| **Add custom leave type**                 | No                | Yes                     | Yes                        |
| **Add / rename / delete Tasks**           | No                | No                      | Yes                        |
| **View Task report**                      | No                | Yes (all shifts)        | Yes (all shifts)           |

- **Regular Staff** can view every shift roster and request leave. They have no edit controls and cannot request leave on locked dates.
- **Supervisors** have the regular staff view plus an edit view for **their own shift only**. Other shifts appear in clearly marked read-only mode. They do not have the staff restrictions.
- **Management** can do everything a supervisor can do across all three shifts, and is the **only** role that can add, rename, and delete Tasks and manage staff records. Management does **not** request or take leave of any sort. Their role is the bigger picture of roster and duty management.

## 11. Role views and functions

### 11.1 Regular Staff view

Regular staff can see the roster of **all shifts**, which helps them plan their schedules. The staff view includes:

- **Two views with an easy switch:** a **Calendar view** and a **Roster view**, toggled with a clearly visible switch button.
- **Date details panel:** when a staff member selects a date that has remarks, a **side panel** shows their leave details for that date (type, dates, status) and the remark, if any.
- **Request leave on the same page:** the request leave form sits on the **same page as the Calendar view and Roster view**, in the right-hand panel (on mobile, a bottom sheet over the page). While booking, staff can see the dates they want, whether each date is **AM, PM, or Off**, and what has already been planned (other leave, locked dates, Available Slot(s)).
- **Selecting dates:** staff pick a **date range or specific (individual) dates** directly on the calendar or roster. Selected dates are highlighted and appear in the form.
- **Request details:** choose a leave type and add **additional notes** so the supervisor understands the request. Half-day types ask for first or second half. Leave can be requested on **Off days** too. Staff can still submit a request when no slots are left, and the supervisor decides.
- **Approval status:** see whether each request is Pending, Approved, or Rejected. Their list of requests is in the same right-hand panel.
- **Withdraw:** staff can withdraw their own **pending** request. They **cannot** cancel leave that has already been approved; only a supervisor can.
- **Locked dates:** some dates are locked for events. Staff **cannot apply for leave** on locked dates, which are disabled in the date picker. Selecting a locked date shows that it is a **locked date**, with the **remarks** in the side panel on the right explaining why (for example a festive period or an important meeting).
- **Birthday leave:** on a staff member's birthday the roster and calendar show **BD**, even when the birthday falls on an Off day. In that case the leave becomes **BD-IL**, placed on their next closest working day (see section 12.1).
- **Leave taken this month (later release):** a summary of how many leaves they took in the month, so they know how many more they can take. Show as a placeholder card in the first designs.

### 11.2 Supervisor view

Supervisors are also part of the shift roster, so they get the **regular staff view** as well as an **edit view**. A prominent **switch button** toggles between **Edit view** and **Staff view**. Supervisors do **not** have the staff restrictions. In Edit view, for their own shift, they can:

- Assign **duties** (AM, PM, V, V(SB), Off) from a single duty picker. V and V(SB) are assigned the same way as any other duty (see section 5.1).
- **Swap duties** between staff (see section 11.4).
- Assign **Tasks** to their staff, including people on V duty. Task assignment is **optional**, and each person holds only one Task per day, and a person on full-day leave cannot be given a Task.
- Track Tasks done in the **Task report** (section 9.2).
- **Give leave** to staff, **including themselves**: select specific dates or a date range, pick the leave type, and add remarks. Leave given by a supervisor is **already approved**, so it has no approval step.
- **Edit leave** (type, dates, and remarks) and **cancel approved leave**. Only supervisors and Management can cancel approved leave. They can also set leave on staff Off days.
- **Approve or reject pending** leave requests from staff (a reason is required when rejecting). A request **cannot be approved** unless an extra slot is available on every requested date (see section 12.3).
- **Lock dates for events** and add **remarks** explaining why. Locked dates block staff leave requests, but **supervisors can still give leave on locked dates**.
- Set special-event report times and per-date V headcount, and add custom leave types.
- **In Staff view**, a supervisor can **submit leave requests** like regular staff, and can **approve their own request**.
- **In Edit view**, a supervisor can **cancel approved leave** and **give leave** to staff, **including themselves**. Leave a supervisor gives themselves is already approved and needs no approval.

### 11.3 Management view

Management can do everything a supervisor can do across **all shifts**, but does **not** request or take leave of any sort. Their role is to have the **bigger picture** of roster and duty management. In addition, Management can:

- **Rename** Tasks.
- **Add** new Tasks or **delete** Tasks. Deleting a Task deletes all of its existing assignments, so a clear warning is shown first.
- Tasks need **no description**, only a name (maximum 6 characters, spaces included).
- **Lock dates for all shifts at once**, in addition to locking dates for a single shift.
- Track Tasks done across all shifts in the **Task report** (section 9.2).
- **Manage staff records**: add staff, edit their details (including birthday, which drives BD / BD-IL), and move people between shifts [full field list to confirm].

### 11.4 Duty swaps between staff

Swapping duties between staff (often called shift swaps) is **in scope** and is **handled by supervisors**.

- In Edit view, a supervisor picks two staff members and the date(s), and swaps their duties (for example one person's PM for another person's AM).
- The form previews both people's duties after the swap and checks MFL before confirming.
- The roster then shows the swapped duties.
- Supervisors handle swaps for their own shift; Management can handle swaps for all shifts.

> To confirm: whether swaps can be across different shifts (and how strength is counted), and whether staff can request a swap in the app or only supervisors record it.

## 12. Leave management

### 12.1 Common leave types

Common leave types and their full names:

| **Code**    | **Full name**             | **Notes**                                                                                                                    |
|-------------|---------------------------|------------------------------------------------------------------------------------------------------------------------------|
| **AL**      | Local leave               |                                                                                                                              |
| **0.5 AL**  | Half-day local leave      | Requester chooses the first half or second half of the duty timing; the UI shows the actual hours. Counts as 0.5.            |
| **OL**      | Overseas leave            |                                                                                                                              |
| **MWO**     | Mental wellness off       |                                                                                                                              |
| **OML**     | \[full name to be added\] |                                                                                                                              |
| **MC**      | Medical leave             |                                                                                                                              |
| **HL**      | Hospitalised leave        |                                                                                                                              |
| **FCL**     | Family care leave         |                                                                                                                              |
| **CSE**     | Course leave              |                                                                                                                              |
| **BD**      | Birthday leave            | Shown on the birthday, even on an Off day. See the birthday rules below.                                                     |
| **BD-IL**   | Birthday off in lieu      | Used when the birthday falls on an Off day. Placed on the next closest working day.                                          |
| **0.5 OIL** | Half-day off in lieu      | Requester chooses the first half or second half of the duty timing (for example PM first half: 1445 to 1800). Counts as 0.5. |
| **1 OIL**   | Off in lieu (full day)    |                                                                                                                              |

- Each type appears as a short-code chip on the roster. Half-day types (0.5 AL and 0.5 OIL) look visually different (for example half-filled) from full-day leave.

**Birthday leave rules (BD and BD-IL):**

- If a staff member's birthday falls on a **working day**, they take **BD** (birthday leave) on that day.
- If the birthday falls on an **Off day**, the leave becomes **BD-IL**, an off in lieu for the birthday.
- **BD is still shown** on the roster and calendar on the birthday, even when it falls on an Off day.
- The **BD-IL** is placed on the **next closest working day** the staff member has after the birthday **that does not already have leave** (one type of leave per day, section 12.3).
- While BD or BD-IL is on a day, no other leave can be requested or given for that day.
- A BD shown on an Off day is a marker only and does not count in Not in Strength; the BD-IL day counts like other leave [to confirm].
- Birthdays come from the staff record, which Management maintains (section 11.3).

### 12.2 Custom leave types

Supervisors can add a new leave type. The name is limited to **6 characters maximum, spaces included**. The form should show a live counter (for example "4/6"), validate the length, and preview how the chip will look on the roster.

### 12.3 Leave requests from staff

- Staff submit a request, on the same page as the roster and calendar views, with a leave type, **a date range or specific dates**, and **additional notes** for the supervisor. For 0.5 AL and 0.5 OIL they also choose first or second half.
- **One type of leave per person per day.** A staff member cannot hold more than one type of leave on the same day. This includes pending requests, approved leave, supervisor-given leave, half-day leave (two half-days of different types are not allowed), and BD / BD-IL. A request or grant that includes a date which already has leave is blocked with a message naming the date; the form shows the clash before submitting. To change the type on a day, the existing leave is edited, withdrawn, or cancelled first. A BD marker on an Off day is not leave and does not block anything.
- While requesting, staff see live feedback on Available Slot(s) for the chosen dates.
- **Locked dates** cannot be selected by staff.
- Supervisors review requests in a simple **inbox sorted by earliest submitted first**. Each row shows only: **staff name, leave type, dates requested, and time submitted**. The staff notes appear when the request is opened.
- There are **no priority or urgency badges**. Supervisors verify the leave type and judge priority themselves.
- Supervisors approve or reject. A reason is required when rejecting.
- **Slots and approval:** staff can still submit a request when no slots are left, and it is up to the supervisor to deny it. A supervisor **cannot approve** a request unless an extra slot is available on every requested date (a half-day request needs at least 0.5 of a slot). The Approve button is disabled with a message such as "No slot available on [date]" until a slot is freed, for example by editing or cancelling other leave. Reject is always available.
- **Withdrawing:** staff can withdraw their own **pending** request. A withdrawn request leaves the supervisor inbox and shows as Withdrawn in the staff history.
- **Cancelling:** only a supervisor (or Management) can cancel leave that is already approved. Cancelling frees the slot again.
- **Leave on Off days:** staff can request leave on their Off days, and supervisors can set it too. See section 8 for how it is counted.
- Requests have three main statuses: **Pending, Approved, Rejected** (plus Withdrawn when staff withdraw a pending request). Staff can see the status. Only Approved leave affects strength figures and slots.

### 12.4 Leave given by supervisors

- A supervisor (or Management) can give leave directly by selecting a staff member, **specific dates or a date range**, a leave type, and **remarks**.
- This leave is **already approved**. It counts toward Not in Strength immediately and appears on the roster and in the staff member's date details.
- It can be given on **locked dates**.
- The one-type-per-day rule (section 12.3) applies: leave cannot be given on a day where the person already has leave. Editing leave onto new dates is checked the same way.
- A supervisor can give leave to **themselves** in Edit view (already approved, no approval needed), and can also **approve their own request** submitted from Staff view. Management does not request or take leave.
- Supervisors can **edit** leave (type, dates, and remarks) and **cancel** it. Edits and cancellations update the strength figures immediately.
- Leave can be set on staff **Off days** too.

### 12.5 Locked dates

- Supervisors (own shift) and Management (any shift, or **all shifts at once**) can **lock dates for events**.
- When locking a date, the supervisor can add **remarks** explaining why, for example a festive period such as Christmas, or an important meeting on that day. **Balloting** for festive periods is handled **outside the app** for now (a possible future update).
- When anyone selects a locked date, they see that it is a **locked date**, with the **remarks shown in the side panel on the right** detailing why it is locked. This is the same side panel used for leave details.
- Staff cannot request leave on locked dates. Locked dates show a lock marker on the calendar and roster, and are disabled in the staff date picker.
- Supervisors and Management can still give leave on locked dates. Leave that was already approved before the lock is unaffected.
- Locks and their remarks can be edited or removed by the same roles.

### 12.6 Leave taken this month (later release)

Later, staff will see how many leaves they took in the month, so they know how many more they can take. The source of leave entitlements is still to be decided.

## 13. Notifications (future feature)

Notifications will be added later and will be tailored to each user (for example staff see leave decisions and roster changes; supervisors see new requests and low-slot alerts). For now the UI should include a **notification bell with a badge** in the desktop header and mobile top bar, and a placeholder inbox screen.

## 14. Platform and UI requirements

### 14.1 Platforms

- **Desktop-first** web app, with a **full mobile view**.
- Mobile uses bottom tab navigation (Home, Roster, Requests, Profile). The Roster tab holds the Calendar and Roster views with the leave request form as a bottom sheet over the page, so the dates stay visible while booking; the Requests tab lists my requests and their statuses. Forms use bottom sheets and should work one-handed. The mobile calendar view and roster view are switchable in the same way as on desktop, and the mobile roster is a day-by-day agenda or week-strip view with a shift switcher, not a shrunken desktop table.

### 14.2 Visual style

- Simple, calm, easy on the eyes, and highly readable for dense data. No decorative clutter.
- **Light and dark mode toggle** in the header, with sufficient contrast in both modes.
- Neutral base with one restrained accent colour. No brand identity yet, so use a neutral placeholder logo with the name "PS Tracker".
- Suggested colours, always paired with a text label, an icon, or a legend for accessibility (see "Roster view colour coding" below):

| **Item**          | **Suggested colour**                      |
|-------------------|-------------------------------------------|
| **AM**            | Amber                                     |
| **PM**            | Indigo                                    |
| **V (night)**     | Deep navy / purple                        |
| **Off**           | Soft grey                                 |
| **Leave**         | Teal                                      |
| **Special event** | Magenta accent                            |
| **V(SB) standby** | Lighter, outlined version of the V colour |
| **Locked date**   | Neutral hatch pattern with a lock icon    |

**Roster view colour coding.** On the Roster view (desktop grid and mobile day list), **AM, PM, and Off are not written as text**. Each cell is filled with its duty colour instead: AM amber, PM indigo, Off grey, and Off (post-V) grey with a violet outline. The date header shows the shift's duty as a small colour bar. **V and V(SB) keep their text label** on top of their colour, because they are exceptions to the cycle. To stay accessible without text:

- A **colour legend** sits above the roster grid (and on the mobile day card) naming every colour, with duty times.
- Each cell has a hover tooltip and a screen-reader label with the duty name and times.
- Leave chips, Task tags, lock icons, and special-event markers still appear on top of the colour.

Other screens (Calendar view, side panel, Home, forms) keep text labels for duties.

### 14.3 Switches and toggles

- **Calendar view / Roster view** switch: available to every role, always visible near the top of the roster area.
- **Edit view / Staff view** switch: Supervisors and Management only, clearly distinct from the calendar/roster switch so the two are not confused. Edit controls appear only in Edit view.

### 14.4 Hero screens (first design pass)

| **#** | **Screen**                       | **Role / platform**              | **Key content**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
|--------|----------------------------------|----------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1      | Roster view with request panel   | Staff, desktop                   | Shift tabs A/B/C, prominent Calendar / Roster switch, month grid with sticky name column and header. Strength rows directly below the date header (Total, Not in Strength, Working, MFL, Available Slot(s)) with a Compact toggle showing only Available Slot(s). AM / PM / V / V(SB) / Off cells, Task tags, leave chips, locked-date markers; Rest days show MFL blank. Right-hand panel with the Request leave form (dates picked on the grid, leave type, notes, half-day selector), date details, and My requests with a Withdraw action. |
| 2      | Calendar view with request panel | Staff, desktop                   | Month calendar showing each date's duty (AM / PM / Off) and Available Slot(s) at a glance, dots on dates with remarks, lock icons on locked dates. Selecting a range or specific dates highlights them and fills the Request leave form in the right-hand panel; selecting a single date shows leave details and the remark, and for a locked date a "Locked date" badge with its remarks. "Leave taken this month" placeholder card.                                                                                                          |
| 3      | Calendar with bottom sheet       | Staff, mobile                    | Calendar view with the Calendar / Roster switch and the duty on each date; a half-height bottom sheet (so the calendar stays visible) for the request leave form and date details, including the locked-date badge and remarks.                                                                                                                                                                                                                                                                                                                |
| 4      | Roster view                      | Staff, mobile                    | Week strip or agenda with a shift switcher, strength figures directly under the dates with a Compact toggle, and the request leave bottom sheet.                                                                                                                                                                                                                                                                                                                                                                                               |
| 5      | Edit view roster grid            | Supervisor, desktop              | Edit view / Staff view switch, own shift editable and other shifts "View only", strength rows below the date header with Compact toggle, cells with V, V(SB), Task tags and leave chips, locked dates, special-event markers, right-hand side panel with Edit / Cancel actions for leave. In Staff view the same page shows the request leave form.                                                                                                                                                                                            |
| 6      | Give and edit leave              | Supervisor, desktop              | Drawer or modal: select staff (including themselves), specific dates or date range (Off days allowed), leave type, remarks. Edit mode changes the type, dates, and remarks of existing leave and offers Cancel leave. Shows that the leave is already approved and that locked dates are allowed.                                                                                                                                                                                                                                              |
| 7      | Assign duties and Tasks          | Supervisor, desktop              | Drawer with two parts: duty assignment from one picker (AM, PM, V, V(SB), Off) for selected people and dates, the same way for every duty; and optional Task assignment (pick one Task, select one or more people; one Task per person per day; unavailable for people on full-day leave).                                                                                                                                                                                                                                                     |
| 8      | Lock dates                       | Supervisor, desktop              | Modal with a calendar for selecting dates or a range, a remarks field explaining why the dates are locked, shift scope (own shift for Supervisors; one, several, or all shifts for Management), and a list of locked dates with their remarks and edit / unlock actions.                                                                                                                                                                                                                                                                       |
| 9      | Leave inbox and review drawer    | Supervisor, desktop              | Requests sorted earliest first showing name, type, dates, time submitted; opening a request shows staff notes and the Available Slot(s) impact. Approve is disabled with a message when a requested date has no available slot; Reject is always available.                                                                                                                                                                                                                                                                                    |
| 10     | All-shift overview               | Management, desktop              | Shifts A, B, C for a selected day or week with strength figures; any duty at or below MFL highlighted; same edit functions as a supervisor.                                                                                                                                                                                                                                                                                                                                                                                                    |
| 11     | Task management                  | Management, desktop              | List of Tasks (Task 1, Task 2, ...) with Add, Rename, and Delete; name only, 6-character counter, and a delete warning that all existing assignments of that Task will be deleted. Not visible to other roles.                                                                                                                                                                                                                                                                                                                                 |
| 12     | Add custom leave type            | Supervisor / Management, desktop | Modal with 6-character limit, live counter, chip preview.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 13     | Swap duties                      | Supervisor, desktop              | Form to pick two staff and the date(s), preview each person's duty before and after the swap, MFL check, confirm. Management can use it for all shifts.                                                                                                                                                                                                                                                                                                                                                                                        |
| 14     | Staff records                    | Management, desktop              | List of staff with shift, role, and birthday; add staff, edit details, move a person between shifts. Not visible to other roles.                                                                                                                                                                                                                                                                                                                                                                                                               |
| 15     | Task report                      | Supervisor / Management          | Filter by year, month, or date range, and by shift. Summary card per Task (days, people), staff-by-Task table with totals, expandable dates per person, "include scheduled" and "hide staff with no Tasks" options. See section 9.2. |

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
- A request or grant blocked because the date already has another type of leave.
- A person on V duty with a Task tag.
- The Roster view colour legend, with AM / PM / Off shown by colour only.
- The Task report filtered by year, by month, and by a date range.

### 14.6 Sample data

For now, use placeholder staff names that are each a **single 5-character word** (for example Alpha, Bravo, Delta, Eagle, Frost, Grace, Haven, Ivory, Jolly, Karma). Do not use realistic personal names. Names may repeat across different shifts.

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

- Full name of the OML leave code.
- BD / BD-IL: whether they are given automatically or requested, whether they need an available slot, and whether the BD-IL day can be moved.
- Duty swaps: whether swaps can be across different shifts (and how strength is counted), and whether staff can request a swap in the app.
- Staff records: which details are kept (for example name, shift, role, birthday).
- V(SB): how a standby person's own cycle looks around their standby day (for example, which days they are normally on, and whether their following block changes).
- Whether the "extra slot needed" rule for approval also applies to leave a supervisor gives directly, to a supervisor's own leave, and to edits of existing leave.
- Where leave entitlements come from, for the future "leave taken this month" summary.
- Branding: final app name, logo, and accent colour.
- Notification design and rules (future).
- Tasks on non-working days: whether a Task may be assigned on an Off day or on a V(SB) standby day (currently allowed; only full-day leave blocks a Task).
- BD on a working-day birthday that already has other leave: currently treated like an Off-day birthday (BD marker, BD-IL on the next free working day). To confirm.
- Colour-only duties on the Roster view: confirm the legend and tooltips are enough for colour-blind users, or add a pattern for AM vs PM.
- Task report: whether supervisors should see other shifts' Task counts (currently yes, like the roster), and whether an export (for example CSV) is needed.
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
| `npm run dev` | Start the dev server on http://localhost:3000 |
| `npm test` | Unit tests for the cycle, V overlay, strength, and birthday rules |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run db:seed` | Wipe and reseed demo data around the current month |
| `npm run db:migrate` | Create and apply a migration after changing `prisma/schema.prisma` |

### 17.3 Project structure

```
/app
  /login                    demo login
  /(app)/home               today's duty, cycle position, next 7 days
  /(app)/roster             Calendar / Roster views, same-page request panel, and the Edit view
                            (Edit / Staff is a switch on this page: ?mode=edit)
  /(app)/requests           my requests (mobile Requests tab)
  /(app)/task-report        Task report (supervisor / management), section 9.2
  /(app)/tasks              Task management (management only)
  /(app)/profile            profile, theme, links to Tasks and the Task report on mobile
  actions.ts                all Server Actions: requestLeave, approveLeave, giveLeave, assignDuty, assignTask, ...
/components/ui              shadcn/ui components
/components/roster          RosterGrid, CalendarView, MobileRoster, SidePanel, chips and legend
/components/tasks           Task manager, Task report filters and table
/lib
  cycle.ts                  duty cycle, cycle position, V overlay and Off (post-V)
  strength.ts               Total / Not in / Working / MFL / Available Slot(s)
  birthday.ts               BD / BD-IL placement
  leave-rules.ts            one type of leave per person per day
  permissions.ts            role and shift access checks
  roster-data.ts            loads a shift's dates and computes cells and strength rows
  task-report.ts            Task report counts
/prisma
  schema.prisma
  seed.ts                   3 shifts, demo staff and users, duties, V blocks, leave, Tasks, locks, events
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

### 17.5 Build priority

Done: Roster view and same-page leave request (staff), Calendar view, Edit view roster grid (supervisor), give / edit / cancel leave, approve / reject from the leave detail panel, assign duties and Tasks, Task management (management), and the Task report.

Next: the leave inbox page, all-shift overview, lock-date / special-event / V-headcount editors, duty swaps, staff records, and custom leave types. See section 14.4 for the full hero-screen list.

## Appendix: Claude Design prompt

This is the prompt prepared for generating the first UI mockups. It condenses the sections above. Paste it into Claude Design and edit as needed.

Design polished **hero screens** for a responsive web app (desktop and mobile) called **PS Tracker**, a duty roster management system for a shift-based team. There are three roles: Regular Staff, Supervisor, and Management.

**Shifts and cycle:** Staff belong to three fixed shifts, Shift A, Shift B, and Shift C, of 20-30 people each. All shifts follow the same 6-day cycle of 2 PM, 2 AM, 2 Off, offset so that handover runs A to B to C to A. On any given day one shift is on PM, one is on AM, and one is resting. Make the rotation easy to read and show each person's cycle position (for example "PM Day 1 of 2").

**Duties and timings:** The daily duties are AM (0745-1445), PM (1445-2130), V (the night shift, 2130-0745, crossing midnight), V(SB) (standby for V), and Off. V and V(SB) are duty types like AM and PM, so a supervisor assigns them the same way as any other duty, from one duty picker.

**V duty and standby:** Normally 1 person covers V; specific dates can require more. The person works 2 days of V on what would be their 2 Off days after AM, then their next 2-day PM block becomes 2 Off, then they continue normally. Example: PM PM AM AM V V OFF OFF AM AM OFF OFF PM PM. Label the converted Off days "Off (post-V)". For the 2-day V block, one person from the same shift is on V(SB) for the first V day and a different person from the same shift is on V(SB) for the second V day. V(SB) does not affect strength, MFL, or leave slots.

**Special events:** Some dates have the entire shift reporting at a different time. Show a clear "Special Event: report at [time]" indicator on the day header, day view, mobile day card, and affected cells. Special events do not change MFL or leave slots. Public holidays do not affect MFL or duty.

**Minimum headcount (MFL):** Weekday: AM 13, PM 12, V 1. Weekend: AM 14, PM 11, V 1. V MFL can be raised for specific dates.

**Strength figures (each duty, per day):** Total Strength (everyone in the shift); Not in Strength (people out on approved leave or other absence); Working Strength (Total minus Not in Strength); Available Slot(s) (Total minus Not in Strength minus MFL). Only approved leave counts. Half-day leave (0.5 AL, 0.5 OIL) counts as 0.5, so values like 21.5 must display cleanly. Colour-code Available Slot(s): healthy, low (1-2), zero ("No slots"), below MFL (warning). A shift on its Off days shows a "Rest day" state: MFL is left blank, Not in Strength still counts people on leave, and Working Strength and Available Slot(s) are both Total minus Not in Strength. **Placement:** put Total Strength, Not in Strength, Working Strength, MFL, and Available Slot(s) in sticky rows **directly below the date header** so they stay visible while scrolling. Provide a **toggle** (for example "Compact") that minimises the strength counts and MFL and shows only Available Slot(s).

**Regular Staff view:** Staff can see the roster of all shifts to plan their schedules. Provide two views, a **Calendar view** and a **Roster view**, with a clearly visible **switch button** to toggle. The **request leave form sits on the same page** as these views (in a right-hand panel on desktop, a bottom sheet on mobile) so staff can see the dates they want, whether each date is AM, PM, or Off, and what has already been planned while booking. Staff pick a **date range or specific dates** directly on the calendar or roster, choose a leave type, and add **additional notes** for the supervisor. When a staff member selects a date that has remarks, show the leave details (type, dates, status) and the remark in the side panel. They can see whether each request is Pending, Approved, or Rejected in the same panel. Staff can request leave on any day, including their Off days, and can still submit when no slots are left (the supervisor decides). They can **withdraw** a pending request but cannot cancel approved leave. Some dates are **locked** for events, and staff cannot apply for leave on locked dates (show a lock icon and disable them in the date picker). When someone selects a locked date, show that it is a **locked date** and show the **remarks** explaining why in the side panel on the right (for example a festive period or an important meeting). Show BD on the roster and calendar on a staff member's birthday. Include a placeholder card "Leave taken this month" for a later release. Staff have no edit controls.

**Supervisor view:** Supervisors are part of the roster, so they also get the regular staff view, plus an **Edit view**. Provide a prominent **switch button** between **Edit view** and **Staff view** (distinct from the Calendar/Roster switch). In **Staff view** a supervisor can submit leave requests like regular staff and can approve their own request. In **Edit view** they manage only their own shift (other shifts are read-only) and can: assign duties (AM, PM, V, V(SB), Off) from one duty picker; **swap duties** between staff (they handle all shift swaps); assign Tasks (optional, one Task per person per day, not for people on full-day leave); **give leave** to staff, **including themselves**, by selecting specific dates or a date range, a leave type, and remarks (leave they give is already approved, so it has no approval step); **edit leave** and its remarks, and **cancel approved leave** (only supervisors and Management can cancel approved leave); set leave on Off days; approve or **reject pending** staff leave requests (reason required on reject; Approve is disabled unless an extra slot is available on every requested date, and Reject is always available); **lock dates** for events and add remarks explaining why (for example a festive period or an important meeting); set special-event times and per-date V headcount; and add custom leave types. Supervisors can give leave on locked dates.

**Management view:** Management can do everything a Supervisor can do across all shifts, but does **not** request or take leave of any sort (no request form, no "my requests"). Their role is the bigger picture of roster and duty management, so give them a strong all-shift overview. Management can also **rename, add, and delete Tasks**, lock dates for all shifts at once, and **manage staff records** (add staff, edit details such as birthday, move people between shifts). Deleting a Task deletes all of its existing assignments, so show a clear warning before deleting. Tasks need no description, only a name.

**Common leave types:** AL (local leave), 0.5 AL (half-day local leave), OL (overseas leave), MWO (mental wellness off), OML, MC (medical leave), HL (hospitalised leave), FCL (family care leave), CSE (course leave), BD (birthday leave), BD-IL (birthday off in lieu), 0.5 OIL (half-day off in lieu), and 1 OIL (off in lieu). For 0.5 AL and 0.5 OIL the requester picks first half or second half of the duty, showing actual hours. **Birthdays:** BD is shown on the roster and calendar on the staff member's birthday, even when it falls on an Off day. In that case the leave becomes BD-IL, placed on the next closest working day they have. Supervisors can add a custom leave type with a name of maximum 6 characters, spaces included, with a live counter (for example "4/6"), validation, and a chip preview. Custom types count toward Not in Strength like the common types. Each type is a short-code chip; half-day types are half-filled.

**Leave inbox (supervisor):** a simple list sorted by earliest submitted first. Each row shows only staff name, leave type, dates requested, and time submitted, plus Approve and Reject. Approve is disabled with a message like "No slot available on [date]" when a requested date has no available slot. Staff notes appear when a request is opened, together with the resulting Available Slot(s) for those dates. No priority badges.

**Tasks:** Specific duties named Task 1, Task 2, Task 3 and so on, with a name limit of 6 characters including spaces (live counter in the form). Assignment is optional, and people on V duty can be given a Task. A person holds only one Task per day, and a person on full-day leave has no Task for that day (half-day leave keeps the Task). Two or more people can share the same Task. Tasks are purely informational and show what people are doing for that duty. Show the Task as a separate small tag on the roster cell that reads simply "Task 2", next to (never replacing) the duty. Tasks do not conflict with scheduling and do not affect leave, strength, MFL, or leave slots.

**Task report (supervisor and Management):** filter by year, month, or date range and by shift; a summary card per Task, then a staff-by-Task table of days done with totals, expandable dates per person, and options to include scheduled Tasks and hide staff with no Tasks. It must stay readable when there are many Tasks.

**One leave per day:** a person can hold only one type of leave on a day (including pending requests, half-days, and BD / BD-IL). Show the clash in the form and block submitting.

**Hero screens:** Staff: (1) desktop Roster view with the request leave panel on the same page, strength rows below the dates with the Compact toggle, and the Calendar/Roster switch; (2) desktop Calendar view with the request panel and date details (leave details and locked-date remarks) on the right; (3) mobile calendar with a bottom sheet for the request form and date details; (4) mobile Roster view with compact strength figures and the request sheet. Supervisor: (5) desktop Edit view roster grid with the Edit/Staff switch and strength rows below the dates; (6) Give and edit leave form (including for themselves); (7) Assign duties (one picker for AM, PM, V, V(SB), Off) and optional Task assignment; (8) Lock dates modal with a remarks field; (9) leave inbox and review drawer; (13) Swap duties form. Management: (10) all-shift overview; (11) Task management screen with add, rename, and delete, including the delete warning; (14) Staff records screen. Also (12) the add custom leave type modal. If a limit is needed, prioritise screens 1, 2, 3, 5, 6, 7, and 11.

**Navigation and notifications:** Mobile uses bottom tabs (Home, Roster, Requests, Profile); the Roster tab holds the Calendar and Roster views with the request sheet, and Requests lists my requests and statuses. Include a notification bell with a badge in the desktop header and mobile top bar (placeholder only).

**Style and theme:** Simple, calm, easy on the eyes, highly readable for dense data. Provide a light and dark mode toggle and show key screens in both. Neutral base, one restrained accent colour, generous spacing, no clutter. Suggested colours: AM amber, PM indigo, V deep navy/purple, V(SB) as a lighter outlined version of the V colour, Off soft grey, Leave teal, Special Event magenta, locked dates with a hatch pattern and lock icon. On the Roster view, show AM, PM and Off by cell colour only (no text) with a colour legend above the grid; V and V(SB) keep their text labels. Elsewhere pair colours with text labels. Use a neutral placeholder logo with the name "PS Tracker".

**States to show:** slots at zero, a duty below MFL, pending/approved/rejected leave, supervisor-given leave (already approved), special-event day, V block with two V(SB) standby people and post-V Off, locked dates (a selected locked date showing a "Locked date" badge and remarks in the right side panel, disabled in the staff picker, allowed for supervisors), the request form open beside the roster or calendar with dates selected, strength rows in full and Compact mode, Approve disabled when no slot is available, a pending request with a Withdraw action, Off-day leave on a Rest day with MFL blank, a supervisor editing or cancelling leave, Calendar vs Roster view, Edit vs Staff view, a person with no Task, a Task shared by several people, a person on full-day leave with no Task, a person on half-day leave who keeps their Task, a birthday on an Off day (BD on the birthday, BD-IL on the next working day), a duty swap before and after, another shift viewed read-only, the Task delete warning, and the Task management screen visible to Management only.

**Sample data:** placeholder staff names that are each a single 5-character word (for example Alpha, Bravo, Delta, Eagle, Frost, Grace, Haven, Ivory, Jolly, Karma). No realistic personal names.

**Out of scope:** payroll, timesheets, clock-in/attendance, HR records, and balloting for festive periods (handled outside the app for now).
