# Submission

## Links

- **GitHub repository:** _tbd — pushed during the build_
- **Live application:** _tbd — deployed near the end_

## Notes for the reviewer

- The API enforces every authorization and lifecycle rule server-side; the UI only reflects them.
- If the deploy host sleeps when idle, the first request after a pause may take up to a minute.

## Demo credentials

| Role    | Email | Password |
|---------|-------|----------|
| Manager | _tbd_ | _tbd_    |
| Member  | _tbd_ | _tbd_    |

## Stack

| Layer    | What I used                     | Why |
|----------|---------------------------------|-----|
| Frontend | React + TypeScript (Vite)       | Clear client/server split; fast SPA dev. |
| Backend  | Node + Express + TypeScript     | Single guarded API layer; easy to explain the request path. |
| Database | PostgreSQL (Prisma ORM)         | Relational domain; type-safe models + easy migrations. |
| Hosting  | _tbd_                           | |

## Goal checklist

| #  | Goal | Status | Notes |
|----|------|--------|-------|
| 1  | Auth + Manager/Member roles, authz server-side | Done | JWT httpOnly cookie, bcrypt, requireAuth + requireRole middleware; project-scoped guards added with projects module |
| 2  | Projects: create/edit/archive/restore + membership | Done | Managers manage all; members scoped to membership; archive is soft (restore lossless) |
| 3  | Tasks: priorities, descriptions, due dates, blocking deps | Not started | |
| 4  | Strict server-enforced task lifecycle | Not started | |
| 5  | Multi-assignee tasks + "my tasks" | Not started | |
| 6  | Server-side search/filter/sort/pagination | Not started | |
| 7  | Bulk operations with per-task result + CSV export | Not started | |
| 8  | Dashboard: metrics, breakdowns, 8-week chart | Not started | |
| 9  | Immutable history/timeline incl. comments | Not started | |
| 10 | Overdue alerts with dismissal/reappearance | Not started | |

## How much time did I actually spend?

_Tracked in docs/plan.md; summarized here at the end._

## What would I do next, with another 12 hours?

_tbd_

## What am I least happy with in this codebase, and why?

_tbd_
