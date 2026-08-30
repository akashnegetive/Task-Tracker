# Architecture

## Moving pieces

- **Client** — React + TypeScript SPA (Vite). React Query owns server state (fetching, caching,
  invalidation); React Router owns navigation; Recharts renders the dashboard. It holds *no*
  authorization logic beyond hiding controls the user can't use — every rule is re-checked on the
  server.
- **API** — Node + Express + TypeScript, layered as
  `routes → middleware (auth/validation) → services (business rules + authorization) → Kysely → SQL`.
  This is where all authorization, the task-lifecycle state machine, dependency/cycle rules, and the
  append-only history live. Errors flow through one central handler that emits a consistent JSON
  shape `{ error: { code, message, details? } }`.
- **Database** — PostgreSQL, accessed through Kysely (typed query builder) over a `pg` pool. Native
  enums and foreign keys enforce integrity; a trigger makes the history table append-only.

```
  ┌──────────────┐   HTTPS/JSON (cookie)   ┌─────────────────────────────┐      SQL     ┌────────────┐
  │  React SPA   │  ───────────────────▶   │  Express API                │  ─────────▶  │ PostgreSQL │
  │ (React Query)│  ◀───────────────────   │  routes→auth→services→Kysely │  ◀─────────  │            │
  └──────────────┘                         └─────────────────────────────┘              └────────────┘
        ▲                                            │
        └──────────  in production the API also serves the built SPA (same origin)
```

## Where each piece runs

- **Dev:** SPA on Vite `:5173` (proxies `/api` → `:4000`), API on `:4000`, Postgres on `:5432`.
- **Production (single service):** the API process serves the built SPA (static files + SPA
  fallback) *and* the `/api` routes from one origin; Postgres is a managed instance. One origin keeps
  the auth cookie first-party (`SameSite=Lax`) and removes CORS from the request path. See
  `docs/deploy.md`.

## Authorization model (enforced server-side)

- **MANAGER** — org-wide oversight: sees and manages *all* projects, creates/edits/archives
  projects, manages membership, and can act on any task.
- **MEMBER** — scoped to the projects they belong to: sees only those, can create/edit tasks and
  comment within them, but can only *transition* tasks they are assigned to.

Every project-scoped request passes through `assertProjectAccess` / `assertProjectManage`
(`src/lib/access.ts`) inside the service, so the check happens no matter which route reached it.

## Request path — "a member completes a task"

1. **Client** — member clicks "→ Done" on a task. React Query fires
   `POST /api/tasks/:id/transition { status: 'DONE' }` with the httpOnly cookie attached.
2. **Auth middleware** (`requireAuth`) — reads the JWT from the cookie, verifies it, loads the
   *current* user row (so role changes take effect immediately), attaches `req.user`.
3. **Validation** — zod parses the body; an invalid status is a 400 before any logic runs.
4. **Service** (`transitionTask`) —
   a. loads the task and `assertProjectAccess` (member of the project?),
   b. `assertProjectActive` (project not archived),
   c. `assertCanTransition` (manager or assignee — a plain member is 403 here),
   d. `assertValidTransition(from, 'DONE')` against the state machine (illegal ⇒ 422),
   e. checks blocking dependencies — if any blocker isn't DONE ⇒ 422 with the offending tasks.
5. **Transaction** — updates the task (`status='DONE'`, sets `completed_at`) *and* appends a
   `STATUS_CHANGED` row to `task_events`, committing together.
6. **Response** — the fresh task detail (with recomputed `isBlocked`/`isOverdue`) returns; React
   Query invalidates the task, its timeline, the lists, the dashboard and the overdue alerts, so the
   UI updates everywhere at once.

## What I deliberately did not build

- **Real-time updates** (websockets/SSE). The UI refetches via React Query invalidation instead.
  A team tool would want live updates, but polling/invalidation is enough at this scale.
- **Full-text search.** Search is `ILIKE` on title/description — fine for the demo. The scale-up
  path (`pg_trgm`/`tsvector` + GIN) is written up in `schema.md`.
- **Editing/deleting comments.** Comments are immutable by design (they are history). No edit UI.
- **Email/push notifications** for overdue alerts — alerts are surfaced in-app only.
- **Per-project roles.** Roles are org-wide (Manager/Member); a project doesn't have its own role
  matrix. Simpler and sufficient for the brief; a larger product might want project-level roles.
- **Refresh-token rotation.** A single 7-day JWT cookie; no refresh/rotation flow.
- **Hard delete of tasks/projects.** Projects archive (soft); tasks cancel. This preserves history,
  which is a graded requirement.
