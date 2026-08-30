# AI prompts

An honest log of how AI assistance was used on this build: the prompts, what came back, where it was
wrong, and how it was corrected. Kept in rough chronological order.

## 1. Kickoff / planning

**Prompt (paraphrased):** "Build a Project & Task Tracking app for the BUSY take-home, step by step.
10 goals (auth+roles, projects, tasks+deps, lifecycle, multi-assignee, search/filter/sort/paginate,
bulk+CSV, dashboard+8-week chart, immutable history, overdue alerts). Stack: React + Node/Express +
Postgres. Document while building; commit incrementally."

**Result:** Produced the session plan, the monorepo scaffold, and this docs skeleton. Reasonable and
used as-is.

**Correction:** none needed at this stage.

## 2. Schema + ORM — a prompt that produced something wrong

**Prompt (paraphrased):** "Design the Prisma schema for the domain (users, projects, memberships,
tasks, multi-assignee, blocking dependencies, immutable events, overdue dismissals) and run the
initial migration."

**Result:** A complete, reasonable Prisma schema was produced and looked correct. **But it could not
be used**: `prisma generate` and `prisma migrate` both failed in this environment because Prisma
downloads native "engine" binaries from a host that the sandbox blocks (HTTP 403 on
`binaries.prisma.sh`). The generated schema was fine on paper but the *plan* built around Prisma was
wrong for the environment — a good reminder that "the code looks right" isn't "the code runs here."

**Correction:** Reversed the data-layer decision (see `decisions.md` Decision 2). Rebuilt the schema
as a hand-written SQL migration (`0001_init.sql`) and adopted Kysely + `pg`, both pure-JS. This ran
immediately, and the explicit DDL became the basis for `schema.md`. Net: the wrong turn cost ~20
minutes and improved the design story.

**Lesson applied afterwards:** verify tools actually execute in the target environment before
committing an architecture to them.

_(More entries are added as the build progresses.)_
