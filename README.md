# PS Tracker

A duty roster web app for a shift-based team: three fixed shifts on a 6-day AM / PM / Off cycle, with V (night) duty and standby, minimum-headcount tracking, leave requests and approvals, locked dates, duty swaps, and optional Tasks.

- Full spec: [`docs/system-context.md`](docs/system-context.md) (source of truth). Part A is the product rules; Part B (section 17) is the build framework: stack, structure, and conventions.
- Shared Claude Code context: [`CLAUDE.md`](CLAUDE.md)

## Status

Core loop built (build priority, spec section 17.5): Roster and Calendar views with the same-page leave request, supervisor Edit view, give / edit / cancel leave, assign duties and Tasks (including on V duty), approve or reject from the leave detail panel, Task management, and the Task report. One type of leave per person per day is enforced. Still to come: leave inbox page, all-shift overview, lock-date and special-event editors, duty swaps, staff records, and custom leave type editor.

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
| `npm run db:migrate` | Create and apply a migration after changing `prisma/schema.prisma` |

## Where things live

- `lib/cycle.ts`: duty cycle, cycle position, V duty and "Off (post-V)" (derived, never stored)
- `lib/strength.ts`: Total / Not in / Working / MFL / Available Slot(s)
- `lib/permissions.ts`: role and shift checks, used by the UI and enforced in every Server Action
- `lib/leave-rules.ts`: one type of leave per person per day
- `lib/task-report.ts`: Task report counts (page: `/task-report`)
- `lib/roster-data.ts`: loads a shift's month and computes cells and strength rows
- `components/roster/`: roster grid, calendar, mobile agenda, side panel
- `prisma/seed.ts`: demo shifts, staff, leave, V blocks, Tasks, locks and events

## Team workflow

1. `git checkout main` and `git pull`
2. `git checkout -b feature/your-thing`
3. Commit small and often, push your branch, and open a pull request into `main`
4. Merge PRs one at a time, then everyone pulls `main`

Try risky ideas on a `try/...` branch. If it fails, delete the branch.
