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
npm run prisma:migrate        # create schema
npm run seed                  # demo users + sample data
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
- `npm run build` / `npm start` — production build & run
- `npm run prisma:migrate` — apply migrations
- `npm run seed` — reset & seed demo data
- `npm test` — API + lifecycle tests

Frontend (`client/`):
- `npm run dev` — Vite dev server
- `npm run build` — production build
