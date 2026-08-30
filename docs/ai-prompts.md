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

## 3. Verification approach — a wrong turn that wasted time

**Prompt (paraphrased):** "Run the API in the background and curl the endpoints to smoke-test."

**Result:** Repeatedly failed. The sandbox reaps background processes between shell invocations, so
the server would report "listening" and then be gone by the next command, and some calls returned a
misleading exit code. I burned time chasing "why did the server die" before recognising the pattern.

**Correction:** Pivoted verification to **supertest**, which drives the Express app in-process (no
port, no background process). This runs to completion in one call and became the real, durable test
suite (26 tests). For the one thing that genuinely needs a live server (the SPA being served), I
started it detached with `setsid` and checked it in a separate call.

**Lesson:** when the environment fights a testing approach, change the approach rather than the
environment.

## 4. Task list query typing — a small wrong answer

**Prompt (paraphrased):** "Type the `validateQuery` middleware generically as
`ZodSchema<T>` and infer `T`."

**Result:** TypeScript rejected it. Schemas with `.default()` have different *input* and *output*
types, which `ZodSchema<T>` (input = output = T) can't represent, so passing the list-query schema
failed to compile.

**Correction:** Relaxed the helper to accept `ZodTypeAny` and cast the parsed result at the call
site. Correct and pragmatic; the alternative (threading input/output type params everywhere) wasn't
worth it.

## 5. Frontend build errors

**Prompt (paraphrased):** "Wire the API client with `import.meta.env.VITE_API_URL` and build."

**Result:** Two compile errors — `import.meta.env` wasn't typed (missing `vite/client` reference),
and passing a named `interface` where `Record<string, unknown>` was expected failed because TS
interfaces lack an implicit index signature.

**Correction:** Added `/// <reference types="vite/client" />` and cast the filter objects at the two
call sites. Both are well-known TS/Vite footguns; quick fixes once identified.

_(This log is chronological and was written as the build happened, not reconstructed afterward.)_
