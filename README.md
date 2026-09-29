# PS Tracker

A duty roster web app for a shift-based team: three fixed shifts on a 6-day AM / PM / Off cycle, with V (night) duty and standby, minimum-headcount tracking, leave requests and approvals, locked dates, duty swaps, and optional Tasks.

- Full spec: [`docs/system-context.md`](docs/system-context.md) (source of truth). Part A is the product rules; Part B (section 17) is the build framework: stack, structure, and conventions.
- Shared Claude Code context: [`CLAUDE.md`](CLAUDE.md)

## Status

Core loop built (build priority, spec section 17.5): Roster and Calendar views with the same-page leave request, supervisor Edit view, give / edit / cancel leave, assign duties (V, V(SB), Off(V), DOS/FDO) and Tasks, lock dates and set special events, approve or reject from the leave detail panel, Task management, the Task report, dayworkers with Ops duty and a duty count, Extra shift duty, placeholder Support and Recall rows, duty swaps (pickable directly on the roster), the My Requests / Manage requests pages (leave inbox included), and staff records with Task proficiency. One type of leave per person per day is enforced. Still to come: all-shift overview and custom leave type editor.

## Stack

Next.js 16 (App Router, TypeScript), Prisma 7 with SQLite (`better-sqlite3` adapter), Tailwind CSS 4, shadcn/ui (Radix). Server Actions in `app/actions.ts` are the backend.

## Getting started

Needs Node.js 20 or later.

```
git clone <repo-url>
cd ps-tracker
npm install          # also generates the Prisma client
npm run setup        # creates prisma/dev.db and seeds demo data
npm run dev          # http://localhost:3000
```

Pick a demo user on the login screen (Management, or a Supervisor / Regular Staff per shift). There are no passwords in the demo build.

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm test` | Unit tests for the cycle, V overlay, strength and birthday rules |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run db:seed` | Wipe and reseed demo data (around the current month) |
| **Clear roster (dev)** button | TEMPORARY, top of every page for supervisors and Management, dev only. Deletes every duty, leave, Task assignment, lock, event, Ops duty and Extra; keeps staff, dayworkers, the Task list and leave types. Remove `app/dev-actions.ts` and `components/dev-clear-roster.tsx` when no longer needed |
| `npm run db:migrate` | Create and apply a migration after changing `prisma/schema.prisma` |

## Where things live

- `lib/cycle.ts`: duty cycle, cycle position, V duty and "Off (post-V)" (derived, never stored)
- `lib/strength.ts`: Total / Not in / Working / MFL / Available Slot(s)
- `lib/permissions.ts`: role and shift checks, used by the UI and enforced in every Server Action
- `lib/leave-rules.ts`: one type of leave per person per day
- `lib/domain.ts`: duty types, DOS/FDO duties, leave types and MFL
- `lib/task-report.ts`: Task report counts (page: `/task-report`)
- `lib/dayworkers.ts`, `lib/dayworker-report.ts`: dayworker username rules and Ops duty counts (page: `/dayworkers`)
- `lib/report-period.ts`: the year / month / range filter shared by both reports
- `lib/roster-data.ts`: loads a shift's month and computes cells and strength rows
- `lib/swaps.ts`, `lib/swap-data.ts`: duty swap exchange/preview and the checks behind it (pages: `/requests`, `/manage-requests`, and the roster's Swap / Request swap tab)
- `lib/leave-report.ts`: leave-taken tally, by type, for the My Requests page
- `components/roster/`: roster grid, calendar, mobile agenda, side panel
- `components/swaps/`, `components/requests/`: the swap request/record form and list; the leave-request inbox
- `prisma/seed.ts`: demo shifts, staff, leave, V blocks, Tasks, locks and events

## Team workflow

1. `git checkout main` and `git pull`
2. `git checkout -b feature/your-thing`
3. Commit small and often, push your branch, and open a pull request into `main`
4. Merge PRs one at a time, then everyone pulls `main`

Try risky ideas on a `try/...` branch. If it fails, delete the branch.
