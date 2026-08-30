import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

export type Role = 'MANAGER' | 'MEMBER';
export type ProjectStatus = 'ACTIVE' | 'ARCHIVED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED';
export type TaskEventType =
  | 'CREATED'
  | 'STATUS_CHANGED'
  | 'FIELD_CHANGED'
  | 'ASSIGNED'
  | 'UNASSIGNED'
  | 'DEPENDENCY_ADDED'
  | 'DEPENDENCY_REMOVED'
  | 'COMMENTED';

/** Timestamps: DB writes/reads Date; defaults are DB-generated. */
type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;

export interface UsersTable {
  id: Generated<string>;
  email: string;
  password_hash: string;
  name: string;
  role: ColumnType<Role, Role | undefined, Role>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ProjectsTable {
  id: Generated<string>;
  name: string;
  description: ColumnType<string, string | undefined, string>;
  status: ColumnType<ProjectStatus, ProjectStatus | undefined, ProjectStatus>;
  created_by_id: string;
  created_at: Timestamp;
  updated_at: Timestamp;
  archived_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
}

export interface ProjectMembershipsTable {
  id: Generated<string>;
  project_id: string;
  user_id: string;
  created_at: Timestamp;
}

export interface TasksTable {
  id: Generated<string>;
  project_id: string;
  title: string;
  description: ColumnType<string, string | undefined, string>;
  priority: ColumnType<TaskPriority, TaskPriority | undefined, TaskPriority>;
  status: ColumnType<TaskStatus, TaskStatus | undefined, TaskStatus>;
  due_date: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  created_by_id: string;
  created_at: Timestamp;
  updated_at: Timestamp;
  completed_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
}

export interface TaskAssigneesTable {
  id: Generated<string>;
  task_id: string;
  user_id: string;
  assigned_by_id: string;
  assigned_at: Timestamp;
}

export interface TaskDependenciesTable {
  id: Generated<string>;
  task_id: string;
  depends_on_task_id: string;
  created_at: Timestamp;
}

export interface TaskEventsTable {
  id: Generated<string>;
  task_id: string;
  actor_id: string | null;
  type: TaskEventType;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: ColumnType<any | null, any | null | undefined, any | null>;
  created_at: Timestamp;
}

export interface OverdueDismissalsTable {
  id: Generated<string>;
  task_id: string;
  user_id: string;
  due_date_at_dismissal: ColumnType<Date, Date | string, Date | string>;
  dismissed_at: Timestamp;
}

export interface Database {
  users: UsersTable;
  projects: ProjectsTable;
  project_memberships: ProjectMembershipsTable;
  tasks: TasksTable;
  task_assignees: TaskAssigneesTable;
  task_dependencies: TaskDependenciesTable;
  task_events: TaskEventsTable;
  overdue_dismissals: OverdueDismissalsTable;
}

// Convenience row types
export type UserRow = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;

export type ProjectRow = Selectable<ProjectsTable>;
export type TaskRow = Selectable<TasksTable>;
export type TaskEventRow = Selectable<TaskEventsTable>;
