import { sql, type Expression, type SqlBool } from 'kysely';
import { db } from '../../db';
import type { AuthUser } from '../../types/express';
import type { TaskPriority, TaskStatus } from '../../db/types';
import { assertProjectAccess } from '../../lib/access';
import type { ListTasksQuery } from './tasks.schemas';

export interface TaskListItem {
  id: string;
  projectId: string;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  isOverdue: boolean;
  isBlocked: boolean;
  assignees: { id: string; name: string }[];
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type Scope = { kind: 'project'; projectId: string } | { kind: 'assignee'; userId: string };

const OPEN_STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW'] as const;

/** Builds the shared WHERE conditions for scope + filters (used by list and export). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildConditions(scope: Scope, q: ListTasksQuery) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (eb: any): Expression<SqlBool>[] => {
    const conds: Expression<SqlBool>[] = [];

    if (scope.kind === 'project') {
      conds.push(eb('t.project_id', '=', scope.projectId));
    } else {
      conds.push(
        eb.exists(
          eb
            .selectFrom('task_assignees as mine')
            .select('mine.id')
            .whereRef('mine.task_id', '=', 't.id')
            .where('mine.user_id', '=', scope.userId),
        ),
      );
    }

    if (q.search) {
      conds.push(eb.or([eb('t.title', 'ilike', `%${q.search}%`), eb('t.description', 'ilike', `%${q.search}%`)]));
    }
    if (q.status && q.status.length) conds.push(eb('t.status', 'in', q.status));
    if (q.priority && q.priority.length) conds.push(eb('t.priority', 'in', q.priority));
    if (q.assigneeId) {
      conds.push(
        eb.exists(
          eb
            .selectFrom('task_assignees as fa')
            .select('fa.id')
            .whereRef('fa.task_id', '=', 't.id')
            .where('fa.user_id', '=', q.assigneeId),
        ),
      );
    }
    if (q.dueAfter) conds.push(eb('t.due_date', '>=', new Date(q.dueAfter)));
    if (q.dueBefore) conds.push(eb('t.due_date', '<=', new Date(q.dueBefore)));
    if (q.overdue !== undefined) {
      const overdueExpr = eb.and([
        eb('t.due_date', 'is not', null),
        eb('t.due_date', '<', new Date()),
        eb('t.status', 'in', OPEN_STATUSES),
      ]);
      conds.push(q.overdue ? overdueExpr : eb.not(overdueExpr));
    }
    if (q.blocked !== undefined) {
      const blockedExpr = eb.exists(
        eb
          .selectFrom('task_dependencies as d')
          .innerJoin('tasks as bt', 'bt.id', 'd.depends_on_task_id')
          .select('d.id')
          .whereRef('d.task_id', '=', 't.id')
          .where('bt.status', 'not in', ['DONE', 'CANCELLED']),
      );
      conds.push(q.blocked ? blockedExpr : eb.not(blockedExpr));
    }
    return conds;
  };
}

/** Shared, server-side task query: search + filter + sort + pagination. */
export async function listTasks(
  user: AuthUser,
  scope: Scope,
  q: ListTasksQuery,
): Promise<Paginated<TaskListItem>> {
  if (scope.kind === 'project') {
    await assertProjectAccess(user, scope.projectId); // authorization
  }

  const where = buildConditions(scope, q);

  // Total count
  const totalRow = await db
    .selectFrom('tasks as t')
    .select((eb) => eb.fn.countAll<string>().as('count'))
    .where((eb) => eb.and(where(eb)))
    .executeTakeFirst();
  const total = Number(totalRow?.count ?? 0);

  // Page of rows
  let query = db
    .selectFrom('tasks as t')
    .select(['t.id', 't.project_id as projectId', 't.title', 't.priority', 't.status', 't.due_date as dueDate', 't.completed_at as completedAt', 't.created_at as createdAt'])
    .where((eb) => eb.and(where(eb)));

  // Sorting — priority sorts by severity, not alphabetically.
  if (q.sort === 'priority') {
    const dir = sql.raw(q.order === 'asc' ? 'asc' : 'desc');
    query = query.orderBy(
      sql`case t.priority when 'URGENT' then 4 when 'HIGH' then 3 when 'MEDIUM' then 2 else 1 end ${dir}`,
    );
  } else {
    const column = {
      createdAt: 't.created_at',
      updatedAt: 't.updated_at',
      dueDate: 't.due_date',
      title: 't.title',
      status: 't.status',
    }[q.sort] as string;
    query = query.orderBy(sql.ref(column), q.order);
  }
  query = query.orderBy('t.id', 'asc'); // stable tiebreaker for pagination

  const rows = await query.limit(q.pageSize).offset((q.page - 1) * q.pageSize).execute();
  const ids = rows.map((r) => r.id);

  // Assignees + blocked flags for just this page (no N+1).
  const [assigneeRows, blockedRows] = await Promise.all([
    ids.length
      ? db
          .selectFrom('task_assignees as ta')
          .innerJoin('users as u', 'u.id', 'ta.user_id')
          .select(['ta.task_id', 'u.id', 'u.name'])
          .where('ta.task_id', 'in', ids)
          .execute()
      : Promise.resolve([]),
    ids.length
      ? db
          .selectFrom('task_dependencies as d')
          .innerJoin('tasks as bt', 'bt.id', 'd.depends_on_task_id')
          .select('d.task_id')
          .where('d.task_id', 'in', ids)
          .where('bt.status', 'not in', ['DONE', 'CANCELLED'])
          .groupBy('d.task_id')
          .execute()
      : Promise.resolve([]),
  ]);

  const assigneesByTask = new Map<string, { id: string; name: string }[]>();
  for (const a of assigneeRows) {
    const list = assigneesByTask.get(a.task_id) ?? [];
    list.push({ id: a.id, name: a.name });
    assigneesByTask.set(a.task_id, list);
  }
  const blockedSet = new Set(blockedRows.map((b) => b.task_id));
  const now = Date.now();

  const items: TaskListItem[] = rows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    title: r.title,
    priority: r.priority,
    status: r.status,
    dueDate: r.dueDate,
    completedAt: r.completedAt,
    createdAt: r.createdAt,
    isOverdue:
      r.dueDate !== null &&
      r.status !== 'DONE' &&
      r.status !== 'CANCELLED' &&
      new Date(r.dueDate).getTime() < now,
    isBlocked: blockedSet.has(r.id),
    assignees: assigneesByTask.get(r.id) ?? [],
  }));

  return { items, page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) };
}

/** All matching tasks (no pagination) with assignee names — for CSV export. */
export async function exportTasks(user: AuthUser, scope: Scope, q: ListTasksQuery): Promise<TaskListItem[]> {
  if (scope.kind === 'project') await assertProjectAccess(user, scope.projectId);
  const where = buildConditions(scope, q);

  const rows = await db
    .selectFrom('tasks as t')
    .select(['t.id', 't.project_id as projectId', 't.title', 't.priority', 't.status', 't.due_date as dueDate', 't.completed_at as completedAt', 't.created_at as createdAt'])
    .where((eb) => eb.and(where(eb)))
    .orderBy('t.created_at', 'desc')
    .execute();

  const ids = rows.map((r) => r.id);
  const assigneeRows = ids.length
    ? await db
        .selectFrom('task_assignees as ta')
        .innerJoin('users as u', 'u.id', 'ta.user_id')
        .select(['ta.task_id', 'u.id', 'u.name'])
        .where('ta.task_id', 'in', ids)
        .execute()
    : [];
  const byTask = new Map<string, { id: string; name: string }[]>();
  for (const a of assigneeRows) {
    const list = byTask.get(a.task_id) ?? [];
    list.push({ id: a.id, name: a.name });
    byTask.set(a.task_id, list);
  }
  const now = Date.now();
  return rows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    title: r.title,
    priority: r.priority,
    status: r.status,
    dueDate: r.dueDate,
    completedAt: r.completedAt,
    createdAt: r.createdAt,
    isOverdue: r.dueDate !== null && r.status !== 'DONE' && r.status !== 'CANCELLED' && new Date(r.dueDate).getTime() < now,
    isBlocked: false,
    assignees: byTask.get(r.id) ?? [],
  }));
}
