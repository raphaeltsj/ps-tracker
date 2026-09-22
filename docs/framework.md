# PS Tracker — Repo Context for Claude

This file is project context for Claude (or any AI coding assistant) working in this repository. It covers the **tech stack, project structure, and build conventions**.

For the **product/domain rules** — shifts, duty cycle, MFL, strength formulas, leave types, roles and permissions, Tasks, locked dates, UI requirements, and open items — read **`docs/system-context.md`** in this repo. That file is the single source of truth for how the system should behave; this file is only about how it should be built. Read both before implementing any feature.

## What this app is

PS Tracker is a duty roster management web app for a shift-based team (~60-90 people across three shifts). See `docs/system-context.md` for full details. No deployment is needed yet — this is built and run locally for a hackathon demo.

## Tech stack

- **Framework:** Next.js (App Router), TypeScript
- **Database:** SQLite (single file, zero setup)
- **ORM:** Prisma
- **Styling:** Tailwind CSS
- **Components:** shadcn/ui (Radix + Tailwind, copied into the repo, not a black-box dependency)
- **Auth:** Simple session-based auth. No need for a full identity provider — a seeded set of demo users (one per role, per shift) selectable from a login screen is sufficient for the demo.
- **Backend:** There is no separate backend service. Server Actions and Route Handlers inside this same Next.js project are the backend; Prisma is the data access layer; SQLite is storage.

Do not introduce Postgres, Vercel-specific features, Firebase, or a separate Express server unless explicitly asked — the whole point of this stack is one project, zero external services, and easy local `npm run dev`.

## Suggested project structure

```
/app
  /(auth)/login
  /(app)/roster            — Calendar/Roster view + same-page leave request panel (staff)
  /(app)/edit               — Edit view (supervisor/management)
  /(app)/requests           — leave inbox (supervisor/management)
  /(app)/tasks              — Task management (management only)
  /(app)/staff               — staff records (management only)
  /api or Server Actions    — mutations: requestLeave, approveLeave, assignDuty, lockDate, etc.
/components/ui              — shadcn/ui components
/components/roster          — RosterGrid, CalendarView, StrengthRow, DutyCell, LeaveChip, etc.
/lib
  /strength.ts              — pure functions computing Total/Not-in-Strength/Working/Available Slots
  /cycle.ts                 — duty cycle + V duty overlay logic
  /permissions.ts           — role/shift-based access checks
/prisma
  schema.prisma
  seed.ts                   — seeds 3 shifts, demo staff, demo users, sample duties
/docs
  system-context.md              — full domain spec (source of truth for product rules)
```

## Build conventions

- **Derive, don't store:** strength figures (Total Strength, Not in Strength, Working Strength, Available Slot(s)) are always computed from duty and leave records in `/lib/strength.ts`, never stored as their own columns. Same for cycle position and duty-on-a-given-date — compute from the shift's offset and the date, don't hardcode a calendar.
- **One duty picker:** AM, PM, V, V(SB), and Off are all the same kind of "duty" entity/enum — do not build separate code paths or UI for assigning V/V(SB) versus other duties.
- **Server Actions over a separate API layer:** prefer Next.js Server Actions co-located with the feature for mutations (request leave, approve, assign duty, lock date, etc.) rather than building a REST/GraphQL API.
- **Permission checks live in one place:** put role/shift access logic in `/lib/permissions.ts` and call it from both the UI (to hide controls) and the Server Action (to actually enforce it) — never rely on the UI hiding a button as the only protection.
- **Seed realistic-shaped data:** `prisma/seed.ts` should create 3 shifts, staff with placeholder 5-character names, a handful of duties/leave/Tasks already assigned, so the app looks populated on first run rather than empty.
- **Flag, don't guess:** if a feature's behavior isn't fully specified in `docs/system-context.md` (see its Open Items section), implement the most reasonable interpretation and leave a `// TODO(open item):` comment rather than silently deciding — several rules (OML full name, BD-IL strength counting, cross-shift duty swaps, staff record fields) are still unconfirmed.

## Build priority

If not building everything at once, start with: Roster view + same-page leave request (staff), Calendar view, Edit view roster grid (supervisor), Give/edit leave, Assign duties + Tasks, Task management (management). Add the leave inbox, all-shift overview, lock dates, swap duties, staff records, and custom leave types after the core loop works. See section 14.4 of the context doc for the full hero-screen list and its own suggested priority order.
