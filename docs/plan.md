# Plan

This is a living document. I update it at the start and end of each working session.

## How the work is broken into sessions

I split the build into vertical slices rather than "all backend then all frontend", so that after
each session there is something demonstrably working end to end. The backend is built slightly
ahead of the frontend because the server is where the graded logic lives (authorization, lifecycle,
history), and I wanted the data contracts stable before wiring UI.

| Session | Focus | Goals touched |
|---------|-------|---------------|
| 1 | Scaffold monorepo, tooling, docker Postgres, git, docs skeleton | infra |
| 2 | Database schema + Prisma models + migration | foundation for all |
| 3 | Auth: register/login, JWT cookie, roles, server-side authz middleware | 1 |
| 4 | Projects: CRUD, archive/restore, membership | 2 |
| 5 | Tasks: priority/description/due/deps + strict lifecycle | 3, 4 |
| 6 | Multi-assignee + My Tasks | 5 |
| 7 | Search / filter / sort / pagination | 6 |
| 8 | Bulk operations + CSV export | 7 |
| 9 | Immutable history/timeline + comments | 9 |
| 10 | Overdue alerts + dismissal/reappearance | 10 |
| 11 | Dashboard metrics + 8-week completion chart | 8 |
| 12 | React frontend across all features | all |
| 13 | Seed data, tests, demo credentials | all |
| 14 | Finalize docs + deploy (GitHub + Neon + host) | all |

## Build order rationale

- **Schema first.** Almost every goal reads or writes the same core tables (tasks, task_events).
  Getting the schema and the immutable-history model right early avoids reworking every endpoint.
- **Authz before features.** Server-side authorization is goal 1 and is cross-cutting; building the
  middleware first means every feature endpoint is guarded from the moment it exists.
- **History/timeline before dashboard & alerts.** The dashboard's 8-week chart and the overdue logic
  both lean on the event log and task state, so the log needs to exist first.

## Estimate vs actual

Filled in as sessions complete.

| Session | Estimate | Actual | Notes |
|---------|----------|--------|-------|
| 1 | 0.5h | ~0.5h | Scaffold + local Postgres (Docker daemon unavailable → ran a native PG cluster). |
| 2 | 0.75h | ~1.0h | Overran: Prisma blocked by sandbox egress; reversed to Kysely + SQL migrations. |

## Cuts

Recorded here as they happen (things deferred when short on time).

- **Prisma** cut in session 2 (environment couldn't fetch its engine binaries) → Kysely + `pg`.
- Full-text search deferred: shipping `ilike` search now, `pg_trgm`/`tsvector` noted in schema.md
  as the scale-up path rather than built for the demo.
