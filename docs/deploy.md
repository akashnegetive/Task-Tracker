# Deployment

The app deploys as a **single web service**: the Node/Express server serves the API *and* the built
React SPA from one origin, backed by a managed PostgreSQL database. One URL, one env, first-party
auth cookie.

The commands below are what the maintainer runs by hand — they need your GitHub and host accounts.

## 1. Push to GitHub

From the repo root:

```bash
git remote add origin https://github.com/<you>/tasktracker.git
git branch -M main
git push -u origin main
```

(The repo already has an incremental commit history — don't squash it.)

## 2. Provision Postgres (Neon — free)

1. Create a project at https://neon.tech → copy the **connection string** (the *pooled* one is fine).
   It looks like `postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require`.

## 3. Deploy (Render — free) — one web service

**Option A — Blueprint (uses `render.yaml`):** New → Blueprint → pick the repo. Render reads
`render.yaml`, creates the web service *and* a free Postgres, wires `DATABASE_URL`, and generates
`JWT_SECRET`. Done.

**Option B — by hand:** New → Web Service → connect the repo, then set:

| Setting | Value |
|---|---|
| Runtime | Node |
| Build command | `npm run build && npm run migrate` |
| Start command | `npm start` |
| Environment | `NODE_ENV=production`, `JWT_SECRET=<a long random string>`, `DATABASE_URL=<Neon string>` |

`npm run build` installs both workspaces, builds the client, compiles the server, then `npm run
migrate` applies the SQL migrations against `DATABASE_URL`.

## 4. Seed demo data (once)

`npm run seed` **resets and reseeds** the database — only run it on a fresh deploy. On Render, use a
one-off Job or the shell:

```bash
npm run seed
```

This creates the demo accounts in `SUBMISSION.md` (`manager@tasktracker.dev` / `password123`, etc.).

## 5. Fill in SUBMISSION.md

Put the live URL and GitHub URL at the top of `SUBMISSION.md` and commit.

---

### Notes
- **Cookies:** in production the auth cookie is `Secure` + `SameSite=None`-safe, but since the SPA and
  API share an origin it stays first-party (`SameSite=Lax`) — nothing extra to configure.
- **Cold starts:** the free tier sleeps when idle; the first request after a pause can take ~30–60s.
- **Alternative hosts:** any Node host works (Railway, Fly.io, a VM). Set the same three env vars,
  run `npm run build`, `npm run migrate`, `npm start`. For split hosting (static client + separate
  API) you'd set `CLIENT_ORIGIN` and `VITE_API_URL` and accept cross-site cookies — the single-service
  path avoids that.
