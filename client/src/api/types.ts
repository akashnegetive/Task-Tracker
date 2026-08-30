export type Role = 'MANAGER' | 'MEMBER';
export type ProjectStatus = 'ACTIVE' | 'ARCHIVED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  createdById: string;
  createdAt: string;
  archivedAt: string | null;
  memberCount: number;
  taskCount: number;
  openTaskCount: number;
}

export interface ProjectMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  joinedAt: string;
}

export interface ProjectDetail {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  createdById: string;
  createdAt: string;
  archivedAt: string | null;
  members: ProjectMember[];
}

export interface TaskListItem {
  id: string;
  projectId: string;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  isOverdue: boolean;
  isBlocked: boolean;
  assignees: { id: string; name: string }[];
}

export interface TaskDetail {
  id: string;
  projectId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  isOverdue: boolean;
  isBlocked: boolean;
  assignees: { id: string; name: string; email: string }[];
  dependencies: { id: string; title: string; status: TaskStatus }[];
  dependents: { id: string; title: string; status: TaskStatus }[];
}

export type TaskEventType =
  | 'CREATED'
  | 'STATUS_CHANGED'
  | 'FIELD_CHANGED'
  | 'ASSIGNED'
  | 'UNASSIGNED'
  | 'DEPENDENCY_ADDED'
  | 'DEPENDENCY_REMOVED'
  | 'COMMENTED';

export interface TimelineItem {
  id: string;
  type: TaskEventType;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  actor: { id: string; name: string } | null;
  subjectUser?: { id: string; name: string } | null;
  subjectTask?: { id: string; title: string } | null;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface OverdueAlert {
  taskId: string;
  projectId: string;
  title: string;
  priority: TaskPriority;
  dueDate: string;
  status: TaskStatus;
  reappeared: boolean;
}

export interface Dashboard {
  scope: { projectId: string | null };
  metrics: { total: number; open: number; completed: number; overdue: number; dueSoon: number; completionRate: number };
  byStatus: Record<TaskStatus, number>;
  byPriority: Record<TaskPriority, number>;
  completionByWeek: { weekStart: string; completed: number }[];
}

export interface BulkResult {
  results: { taskId: string; success: boolean; error?: { code: string; message: string } }[];
  summary: { total: number; succeeded: number; failed: number };
}
