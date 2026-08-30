# Database schema

PostgreSQL. DDL lives in `server/migrations/0001_init.sql`; this document explains the shape and the
reasoning. IDs are UUIDs (`gen_random_uuid()`); all timestamps are `timestamptz`.

## Tables & relationships

```
users ──< project_memberships >── projects ──< tasks ──< task_assignees >── users
                                               │  │
                                               │  ├─< task_dependencies >─ (tasks, self-ref)
                                               │  ├─< task_events        (append-only)
                                               │  └─< overdue_dismissals >─ users
```

- **users** — account + global role (`MANAGER` | `MEMBER`). Role is system-wide and drives
  cross-cutting authorization (only managers create/archive projects and manage membership).
- **projects** — `status` (`ACTIVE` | `ARCHIVED`), `created_by_id` (owner), `archived_at`.
  Archive is a soft state, not a delete, so tasks and history survive and restore is lossless.
- **project_memberships** — join table, `UNIQUE(project_id, user_id)`. A user only sees/acts on
  projects they belong to. Membership is the unit authorization checks against.
- **tasks** — `title`, `description`, `priority`, `status`, `due_date`, `created_by_id`,
  `completed_at`. Belongs to exactly one project (`ON DELETE CASCADE`).
- **task_assignees** — many-to-many task↔user, `UNIQUE(task_id, user_id)`. Enables multi-assignee
  and the "my tasks" view. Records `assigned_by_id` for the timeline.
- **task_dependencies** — self-referential edge: `task_id` is *blocked by* `depends_on_task_id`.
  `UNIQUE(task_id, depends_on_task_id)` and `CHECK(task_id <> depends_on_task_id)` stop duplicates
  and self-loops; longer cycles are prevented in the service layer (DFS before insert).
- **task_events** — append-only timeline. One row per meaningful change: creation, status
  transitions, field edits, assignment changes, dependency changes, and comments. See below.
- **overdue_dismissals** — per-user dismissal of an overdue alert, `UNIQUE(task_id, user_id)`,
  storing `due_date_at_dismissal` so the alert can reappear when the task is rescheduled.

## Constraints & integrity

- Enums (`role`, `project_status`, `task_priority`, `task_status`, `task_event_type`) are native
  Postgres enum types — invalid states are rejected at the DB, not just in app code.
- Foreign keys everywhere; `ON DELETE CASCADE` from projects→tasks→(assignees, deps, events,
  dismissals) so removing a project leaves no orphans.
- **Immutability is enforced in the database**: a `BEFORE UPDATE OR DELETE` trigger on
  `task_events` raises an exception. Even a buggy service (or a direct SQL statement) cannot
  rewrite history — the timeline is genuinely append-only.

## Denormalization

Two deliberate denormalizations, each to avoid scanning the event log on hot read paths:

1. **`tasks.completed_at`** — the moment a task first reaches `DONE`. The dashboard's 8-week
   completion chart and "completed this week" metrics bucket on this column with a plain indexed
   range scan, instead of searching `task_events` for the last `STATUS_CHANGED → DONE`.
2. **Comment bodies live in `task_events.new_value`** (see the decision to unify comments into the
   event log). The timeline is then a single ordered query with no join/merge across two tables.

## Indexing

- `tasks`: `(project_id)`, `(project_id, status)`, `(status)`, `(priority)`, `(due_date)`,
  `(completed_at)`, and a functional `lower(title)` index — covering the common board/list filters,
  the overdue scan, the chart, and case-insensitive title search.
- `task_assignees(user_id)` — "my tasks" across all projects.
- `task_events(task_id, created_at)` — timeline reads in order.
- `project_memberships(user_id)` — "projects I belong to".

## Scaling considerations (what I'd do beyond this scope)

- **Search**: `ilike '%term%'` on title/description is fine at demo scale but won't use the
  functional index for infix matches. At volume I'd add a `pg_trgm` GIN index or a `tsvector`
  full-text column with a GIN index.
- **task_events growth**: the log is the fastest-growing table. It's already narrow and indexed by
  `(task_id, created_at)`. At scale I'd partition by month and/or archive cold partitions.
- **Dashboard aggregations**: computed on demand with raw SQL. If they got heavy I'd materialize the
  daily completion counts (a small rollup table refreshed on task completion) and read the chart
  from that.
- **Connection limits**: a single `pg` pool per instance; behind a serverless host I'd add a pooler
  (PgBouncer / Neon's pooled endpoint).
