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

## Decision 2 — Data layer: Prisma → Kysely + raw SQL migrations

- **Chose (finally):** Kysely (a type-safe SQL query builder) over the `pg` driver, with plain
  `.sql` migration files applied by a tiny in-repo runner.
- **Rejected:** Prisma (first choice); TypeORM; a bare `pg` + hand-written query strings.
- **Why:** I started on Prisma for its type-safe models and painless migrations, and Decision 2
  originally read "Prisma ORM." It didn't survive contact with the environment.
- **Later reversed:** The build environment blocks Prisma's engine-binary host, so
  `prisma generate` / `migrate` could not run at all — I couldn't create the schema or verify
  anything locally. Rather than build blind against a tool I couldn't execute, I switched to Kysely +
  `pg`, which are pure-JavaScript and run anywhere (and identically on the deploy host). The
  reversal turned out to be a net positive for *this* project: the domain leans on SQL-shaped work
  (blocking-dependency checks, server-side search/filter/sort/pagination, dashboard time-bucketing),
  Kysely keeps that fully typed while staying close to SQL, and hand-written migrations gave me the
  exact DDL that `schema.md` documents. The cost is more boilerplate than Prisma's generated client.

## Decision 3 — Immutability enforced in the database, not just the app

- **Chose:** A `BEFORE UPDATE OR DELETE` trigger on `task_events` that raises an exception, on top
  of the app only ever inserting.
- **Rejected:** Relying on the service layer to "just never update" the log.
- **Why:** The goal is an *immutable* history. App-layer discipline can be broken by a future bug or
  a stray migration; a DB trigger makes the guarantee structural — even direct SQL can't rewrite the
  timeline. Cheap to add, and it's a claim I can demonstrate rather than assert.

## Decision 4 — Comments are events, not a separate table

- **Chose:** Represent comments as `task_events` rows of type `COMMENTED` (body in `new_value`).
- **Rejected:** A dedicated `comments` table merged into the timeline at read time.
- **Why:** The timeline must interleave field changes, assignments and comments in one ordered
  stream. Making comments first-class events means the timeline is a single indexed query with no
  cross-table merge or pagination-across-two-sources problem, and comments inherit the same
  append-only immutability for free.
- **Later reversed:** _(candidate)_ I first modelled a separate `comments` table in the Prisma
  schema, then dropped it when unifying on the event log. (The primary documented reversal is
  Decision 2; noting this here as the smaller design change it was.)

## Decision 5 — _pending (recorded during a later session)_
