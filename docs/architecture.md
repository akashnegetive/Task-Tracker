# Architecture

A living document; the request-path and "what I didn't build" sections are filled in as the system
takes shape.

## Moving pieces

- **Client** — React (Vite) single-page app. Talks to the API over HTTPS/JSON. Holds no
  authorization logic of its own beyond hiding controls; every rule is re-checked server-side.
- **API** — Node + Express + TypeScript. Layered as `routes → middleware (auth/authz) →
  services (business rules) → Prisma`. This is where all authorization, the task lifecycle state
  machine, and the append-only history live.
- **Database** — PostgreSQL. Source of truth. Relational because the domain is relational
  (projects, memberships, tasks, assignees, dependencies, events, comments).

```
[ React SPA ] --HTTPS/JSON--> [ Express API ] --SQL--> [ PostgreSQL ]
                                   |
                          auth (JWT cookie) + authz guards
```

## Where each piece runs

- Local dev: SPA on Vite (`:5173`), API on Express (`:4000`), Postgres in Docker (`:5432`).
- Deployed (planned): SPA as static hosting, API as a web service, Postgres as a managed instance.
  Exact hosts recorded in SUBMISSION.md once deployed.

## Request path (representative action)

_Filled in with a concrete example (e.g. "member completes a task") once the lifecycle endpoint
exists._

## What I deliberately did not build

_Recorded as scoping decisions are made._
