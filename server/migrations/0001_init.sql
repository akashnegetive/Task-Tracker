-- 0001_init — core schema for TaskTracker
-- Postgres 13+ (uses gen_random_uuid()).

-- ---------- Enums ----------
CREATE TYPE role AS ENUM ('MANAGER', 'MEMBER');
CREATE TYPE project_status AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE task_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE task_status AS ENUM ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED');
CREATE TYPE task_event_type AS ENUM (
  'CREATED', 'STATUS_CHANGED', 'FIELD_CHANGED',
  'ASSIGNED', 'UNASSIGNED', 'DEPENDENCY_ADDED', 'DEPENDENCY_REMOVED', 'COMMENTED'
);

-- ---------- Users ----------
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          role NOT NULL DEFAULT 'MEMBER',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Projects ----------
CREATE TABLE projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  status        project_status NOT NULL DEFAULT 'ACTIVE',
  created_by_id UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at   TIMESTAMPTZ
);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_by ON projects(created_by_id);

-- ---------- Project membership ----------
CREATE TABLE project_memberships (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
CREATE INDEX idx_memberships_user ON project_memberships(user_id);

-- ---------- Tasks ----------
CREATE TABLE tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  priority      task_priority NOT NULL DEFAULT 'MEDIUM',
  status        task_status NOT NULL DEFAULT 'TODO',
  due_date      TIMESTAMPTZ,
  created_by_id UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Denormalized: set when status first becomes DONE. Powers the 8-week chart and
  -- "completed" metrics without scanning the event log.
  completed_at  TIMESTAMPTZ
);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_project_status ON tasks(project_id, status);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_completed_at ON tasks(completed_at);
-- Trigram-free search: a functional index on lower(title) helps prefix/ilike scans.
CREATE INDEX idx_tasks_title_lower ON tasks(lower(title));

-- ---------- Multi-assignee ----------
CREATE TABLE task_assignees (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id        UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by_id UUID NOT NULL REFERENCES users(id),
  assigned_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);
CREATE INDEX idx_assignees_user ON task_assignees(user_id);
CREATE INDEX idx_assignees_task ON task_assignees(task_id);

-- ---------- Blocking dependencies ----------
CREATE TABLE task_dependencies (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- task_id is blocked by depends_on_task_id (which must be DONE first).
  task_id            UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, depends_on_task_id),
  CHECK (task_id <> depends_on_task_id)
);
CREATE INDEX idx_deps_depends_on ON task_dependencies(depends_on_task_id);

-- ---------- Immutable timeline (append-only) ----------
CREATE TABLE task_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  actor_id   UUID REFERENCES users(id),
  type       task_event_type NOT NULL,
  field      TEXT,
  old_value  TEXT,
  new_value  TEXT,          -- for COMMENTED, holds the comment body
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_task_created ON task_events(task_id, created_at);

-- Guard: block UPDATE/DELETE on task_events at the DB level so the log is truly immutable.
CREATE OR REPLACE FUNCTION forbid_task_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'task_events is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_task_events_no_update
  BEFORE UPDATE OR DELETE ON task_events
  FOR EACH ROW EXECUTE FUNCTION forbid_task_event_mutation();

-- ---------- Overdue alert dismissals ----------
CREATE TABLE overdue_dismissals (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id              UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  due_date_at_dismissal TIMESTAMPTZ NOT NULL,
  dismissed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);
CREATE INDEX idx_dismissals_user ON overdue_dismissals(user_id);
