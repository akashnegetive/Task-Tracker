# Decisions

Decisions where a real alternative existed and I picked one. At least one was later reversed
(marked **Later reversed**).

## Decision 1 — Stack: React + Express + Postgres

- **Chose:** React (Vite) SPA, Node + Express + TypeScript API, PostgreSQL.
- **Rejected:** Next.js full-stack; Angular + Spring Boot.
- **Why:** The brief is graded on architecture and on being able to *explain* the request path. A
  clearly separated SPA + REST API + relational DB makes the boundaries obvious and the
  authorization story easy to point at (every request crosses one guarded API layer). A relational
  DB is the right fit for the heavily relational domain (projects → tasks → assignees/deps/events).
  Next.js would blur the client/server boundary the architecture doc needs to describe.

## Decision 2 — Prisma ORM (with raw SQL for aggregations)

- **Chose:** Prisma as the ORM for CRUD and relations; hand-written SQL for the dashboard
  aggregations and the 8-week chart.
- **Rejected:** Raw SQL everywhere (Knex/pg); a heavier ORM (TypeORM).
- **Why:** Prisma gives type-safe models and painless migrations, which keeps the many-relations
  domain honest and speeds iteration. But Prisma's aggregation API is awkward for grouped
  time-bucketed queries, so the dashboard uses `$queryRaw` — the right tool for each job rather than
  forcing one.

## Decision 3 — _pending_

## Decision 4 — _pending_

## Decision 5 — _pending_
