# Submission

## Links

- **GitHub repository:** _tbd — pushed during the build_
- **Live application:** _tbd — deployed near the end_

## Notes for the reviewer

- The API enforces every authorization and lifecycle rule server-side; the UI only reflects them.
  Good things to try: log in as a **member** and confirm you can't create/archive projects or move a
  task you aren't assigned to; try to start a task that's blocked by an unfinished dependency; open a
  task's timeline to see the immutable history.
- The **history table is append-only at the database level** (a trigger rejects UPDATE/DELETE), not
  just in application code.
- If the deploy host sleeps when idle, the first request after a pause may take up to a minute.
- 26 server integration tests: `cd server && npm test`.

## Demo credentials

| Role    | Email                     | Password    |
|---------|---------------------------|-------------|
| Manager | manager@tasktracker.dev   | password123 |
| Member  | alice@tasktracker.dev     | password123 |
| Member  | bob@tasktracker.dev       | password123 |
| Member  | carol@tasktracker.dev     | password123 |

## Stack

| Layer    | What I used                     | Why |
|----------|---------------------------------|-----|
| Frontend | React + TypeScript (Vite)       | Clear client/server split; fast SPA dev. |
| Backend  | Node + Express + TypeScript     | Single guarded API layer; easy to explain the request path. |
| Database | PostgreSQL (Kysely query builder) | Relational domain; typed SQL. Prisma was reversed (see decisions.md). |
| Hosting  | Single service: API serves built SPA; managed Postgres | One origin → first-party cookie, no CORS in prod. |

## Goal checklist

| #  | Goal | Status | Notes |
|----|------|--------|-------|
| 1  | Auth + Manager/Member roles, authz server-side | Done | JWT httpOnly cookie, bcrypt, requireAuth + requireRole middleware; project-scoped guards added with projects module |
| 2  | Projects: create/edit/archive/restore + membership | Done | Managers manage all; members scoped to membership; archive is soft (restore lossless) |
| 3  | Tasks: priorities, descriptions, due dates, blocking deps | Done | Same-project + cycle-safe dependencies; isBlocked/isOverdue computed |
| 4  | Strict server-enforced task lifecycle | Done | State machine + dependency gate + assignee/manager-only transitions |
| 5  | Multi-assignee tasks + "my tasks" | Done | assign/unassign + /api/tasks/mine across projects |
| 6  | Server-side search/filter/sort/pagination | Done | shared query engine; search, multi-filter, severity sort, offset pagination |
| 7  | Bulk operations with per-task result + CSV export | Done | independent per-task results (transition/priority/due/assign); filtered CSV w/ RFC-4180 escaping |
| 8  | Dashboard: metrics, breakdowns, 8-week chart | Done | totals/open/completed/overdue/dueSoon, status+priority breakdowns, 8-week completion buckets |
| 9  | Immutable history/timeline incl. comments | Done | append-only task_events; enriched chronological timeline; comments as events |
| 10 | Overdue alerts with dismissal/reappearance | Done | per-user dismissal; reappears when due date changes; clears when completed/rescheduled ahead |

## How much time did I actually spend?

Roughly **13–14 hours** end to end (per-session breakdown in `docs/plan.md`). The two overruns were
the Prisma→Kysely reversal and reworking local verification around the sandbox reaping background
processes; both are documented.

## What would I do next, with another 12 hours?

1. **Real-time updates** (SSE or websockets) so a teammate's change appears without a refetch.
2. **Full-text search** with `pg_trgm`/`tsvector` + GIN, replacing `ILIKE` (path noted in schema.md).
3. **A Kanban board view** with drag-and-drop between statuses (respecting the same server lifecycle
   rules), alongside the current table.
4. **Frontend test layer** (Playwright E2E for core flows) and unit tests for dashboard
   date-bucketing edge cases (timezones, week boundaries).
5. **Refresh-token rotation** and CSRF hardening (double-submit token) for the cookie auth.
6. **Richer bulk ops** (bulk assign / dependency add) and undo for bulk actions.

## What am I least happy with in this codebase, and why?

- **Frontend has no automated tests.** The backend is well covered (26 integration tests), but the
  React app is verified only by a production build + Playwright screenshots. Given more time the core
  flows deserve E2E coverage.
- **`ILIKE '%term%'` search won't scale.** Honest for the demo, but it bypasses indexes for infix
  matches; I left the proper solution as a documented follow-up rather than half-building it.
- **A few `any`-typed spots in the query layer** (the dashboard `restrict` helper and the list-query
  condition builder). Expressing "apply this WHERE across several differently-shaped queries"
  generically in Kysely got verbose, so I made a deliberate, localized tradeoff. It works and is
  tested, but it's the code I'd most want to tidy.
- **Bundle size** (~610 KB) is dominated by Recharts; code-splitting the dashboard route would help.
