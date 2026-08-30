# TaskTracker

A project & task tracking application for a services company. Managers create projects and
tasks; team members work them through a strict, server-enforced lifecycle. Includes multi-assignee
tasks, blocking dependencies, server-side search/filter/sort/pagination, bulk operations with
per-task results, CSV export, an activity dashboard, an immutable task timeline, and overdue alerts.

## Stack

| Layer     | Choice                          |
|-----------|---------------------------------|
| Frontend  | React + TypeScript (Vite)       |
| Backend   | Node.js + Express + TypeScript  |
| Database  | PostgreSQL (Prisma ORM)         |
| Auth      | JWT in httpOnly cookie, bcrypt  |

See [`docs/architecture.md`](docs/architecture.md) for the full picture and
[`SUBMISSION.md`](SUBMISSION.md) for links, credentials and the goal checklist.

## Repository layout

```
task-tracker/
├── server/     # Express + Prisma API
├── client/     # React (Vite) single-page app
├── docs/       # architecture, schema, plan, decisions, ai-prompts
└── docker-compose.yml   # local Postgres
```

## Quick start (local)

Prerequisites: Node 20+, Docker (for Postgres) or a Postgres connection string.

```bash
# 1. start Postgres
docker compose up -d

# 2. backend
cd server
cp .env.example .env          # adjust if needed
npm install
npm run migrate               # apply SQL migrations
npm run seed                  # demo users + sample data (resets the DB)
npm run dev                   # http://localhost:4000

# 3. frontend (new terminal)
cd client
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173
```

Demo credentials are listed in [`SUBMISSION.md`](SUBMISSION.md).

## Scripts

Backend (`server/`):
- `npm run dev` — start API with hot reload
- `npm run build` / `npm start` — compile & run
- `npm run migrate` — apply SQL migrations
- `npm run seed` — reset & seed demo data
- `npm test` — 26 API + lifecycle integration tests

Frontend (`client/`):
- `npm run dev` — Vite dev server (proxies `/api` → :4000)
- `npm run build` — production build

## Deployment

Deploys as a single web service (the API serves the built SPA) plus managed Postgres. Step-by-step
GitHub + Neon + Render instructions are in [`docs/deploy.md`](docs/deploy.md); a `render.yaml`
blueprint is included.

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — components, request path, what wasn't built
- [`docs/schema.md`](docs/schema.md) — tables, constraints, denormalization, scaling
- [`docs/decisions.md`](docs/decisions.md) — key decisions (incl. the ORM reversal)
- [`docs/plan.md`](docs/plan.md) — sessions, estimates vs actual, cuts
- [`docs/ai-prompts.md`](docs/ai-prompts.md) — AI usage log, incl. wrong turns
