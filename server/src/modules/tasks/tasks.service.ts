import { db } from '../../db';
import type { AuthUser } from '../../types/express';
import type { TaskPriority, TaskStatus } from '../../db/types';
import { assertProjectAccess, assertProjectActive } from '../../lib/access';
import { badRequest, conflict, notFound, unprocessable } from '../../lib/errors';
import { assertValidTransition, requiresUnblocked } from './lifecycle';
import { logEvent } from './tasks.events';
import { getTaskContext, assertCanTransition } from './tasks.access';
import type { CreateTaskInput, UpdateTaskInput } from './tasks.schemas';

function toDateOrNull(v: string | null | undefined): Date | null {
  if (v === null || v === undefined) return null;
  return new Date(v);
}

// ---------- Read ----------

export interface TaskDetail {
  id: string;
  projectId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  isOverdue: boolean;
  isBlocked: boolean;
  assignees: { id: string; name: string; email: string }[];
  dependencies: { id: string; title: string; status: TaskStatus }[];
  dependents: { id: string; title: string; status: TaskStatus }[];
}

export async function getTaskDetail(user: AuthUser, taskId: string): Promise<TaskDetail> {
  const { task } = await getTaskContext(user, taskId);

  const [assignees, dependencies, dependents] = await Promise.all([
    db
      .selectFrom('task_assignees as ta')
      .innerJoin('users as u', 'u.id', 'ta.user_id')
      .select(['u.id', 'u.name', 'u.email'])
      .where('ta.task_id', '=', taskId)
      .orderBy('u.name')
      .execute(),
    db
      .selectFrom('task_dependencies as d')
      .innerJoin('tasks as t', 't.id', 'd.depends_on_task_id')
      .select(['t.id', 't.title', 't.status'])
      .where('d.task_id', '=', taskId)
      .execute(),
    db
      .selectFrom('task_dependencies as d')
      .innerJoin('tasks as t', 't.id', 'd.task_id')
      .select(['t.id', 't.title', 't.status'])
      .where('d.depends_on_task_id', '=', taskId)
      .execute(),
  ]);

  const isBlocked = dependencies.some((d) => d.status !== 'DONE' && d.status !== 'CANCELLED');
  const isOverdue =
    task.due_date !== null &&
    task.status !== 'DONE' &&
    task.status !== 'CANCELLED' &&
    new Date(task.due_date).getTime() < Date.now();

  return {
    id: task.id,
    projectId: task.project_id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    dueDate: task.due_date,
    createdById: task.created_by_id,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    completedAt: task.completed_at,
    isOverdue,
    isBlocked,
    assignees,
    dependencies,
    dependents,
  };
}

// ---------- Create ----------

export async function createTask(user: AuthUser, projectId: string, input: CreateTaskInput) {
  const project = await assertProjectAccess(user, projectId);
  assertProjectActive(project);

  // Validate assignees are members of the project.
  if (input.assigneeIds.length > 0) {
    await assertUsersAreMembers(projectId, input.assigneeIds);
  }
  // Validate dependencies belong to the same project.
  if (input.dependencyIds.length > 0) {
    await assertTasksInProject(projectId, input.dependencyIds);
  }

  const taskId = await db.transaction().execute(async (trx) => {
    const task = await trx
      .insertInto('tasks')
      .values({
        project_id: projectId,
        title: input.title,
        description: input.description,
        priority: input.priority,
        due_date: toDateOrNull(input.dueDate),
        created_by_id: user.id,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    if (input.assigneeIds.length > 0) {
      await trx
        .insertInto('task_assignees')
        .values(input.assigneeIds.map((uid) => ({ task_id: task.id, user_id: uid, assigned_by_id: user.id })))
        .execute();
    }
    if (input.dependencyIds.length > 0) {
      await trx
        .insertInto('task_dependencies')
        .values(input.dependencyIds.map((dep) => ({ task_id: task.id, depends_on_task_id: dep })))
        .execute();
    }

    await logEvent(trx, [
      { taskId: task.id, actorId: user.id, type: 'CREATED', newValue: input.title },
      ...input.assigneeIds.map((uid) => ({
        taskId: task.id,
        actorId: user.id,
        type: 'ASSIGNED' as const,
        field: 'assignee',
        newValue: uid,
      })),
      ...input.dependencyIds.map((dep) => ({
        taskId: task.id,
        actorId: user.id,
        type: 'DEPENDENCY_ADDED' as const,
        field: 'dependency',
        newValue: dep,
      })),
    ]);

    return task.id;
  });

  return getTaskDetail(user, taskId);
}

// ---------- Update fields ----------

export async function updateTask(user: AuthUser, taskId: string, input: UpdateTaskInput) {
  const { task, project } = await getTaskContext(user, taskId);
  assertProjectActive(project);

  const events: Parameters<typeof logEvent>[1] = [];
  const updates: Record<string, unknown> = {};

  if (input.title !== undefined && input.title !== task.title) {
    updates.title = input.title;
    events.push({ taskId, actorId: user.id, type: 'FIELD_CHANGED', field: 'title', oldValue: task.title, newValue: input.title });
  }
  if (input.description !== undefined && input.description !== task.description) {
    updates.description = input.description;
    events.push({ taskId, actorId: user.id, type: 'FIELD_CHANGED', field: 'description', oldValue: task.description, newValue: input.description });
  }
  if (input.priority !== undefined && input.priority !== task.priority) {
    updates.priority = input.priority;
    events.push({ taskId, actorId: user.id, type: 'FIELD_CHANGED', field: 'priority', oldValue: task.priority, newValue: input.priority });
  }
  if (input.dueDate !== undefined) {
    const newDue = toDateOrNull(input.dueDate);
    const oldDue = task.due_date;
    const changed = (newDue?.getTime() ?? null) !== (oldDue ? new Date(oldDue).getTime() : null);
    if (changed) {
      updates.due_date = newDue;
      events.push({
        taskId,
        actorId: user.id,
        type: 'FIELD_CHANGED',
        field: 'dueDate',
        oldValue: oldDue ? new Date(oldDue).toISOString() : null,
        newValue: newDue ? newDue.toISOString() : null,
      });
    }
  }

  if (Object.keys(updates).length === 0) {
    return getTaskDetail(user, taskId);
  }

  await db.transaction().execute(async (trx) => {
    await trx.updateTable('tasks').set({ ...updates, updated_at: new Date() }).where('id', '=', taskId).execute();
    await logEvent(trx, events);
  });

  return getTaskDetail(user, taskId);
}

// ---------- Status transition (the strict lifecycle) ----------

export async function transitionTask(user: AuthUser, taskId: string, target: TaskStatus) {
  const { task, project } = await getTaskContext(user, taskId);
  assertProjectActive(project);
  await assertCanTransition(user, task);

  const from = task.status;
  assertValidTransition(from, target);

  // Dependency gate: cannot start/advance/complete while any blocker is unresolved.
  if (requiresUnblocked(target)) {
    const blockers = await unresolvedBlockers(taskId);
    if (blockers.length > 0) {
      throw unprocessable('Task is blocked by unfinished dependencies', {
        blockedBy: blockers.map((b) => ({ id: b.id, title: b.title, status: b.status })),
      });
    }
  }

  const now = new Date();
  const patch: Record<string, unknown> = { status: target, updated_at: now };
  // Maintain completed_at as "currently completed at".
  if (target === 'DONE' && !task.completed_at) patch.completed_at = now;
  if (from === 'DONE' && target !== 'DONE') patch.completed_at = null;

  await db.transaction().execute(async (trx) => {
    await trx.updateTable('tasks').set(patch).where('id', '=', taskId).execute();
    await logEvent(trx, {
      taskId,
      actorId: user.id,
      type: 'STATUS_CHANGED',
      field: 'status',
      oldValue: from,
      newValue: target,
    });
  });

  return getTaskDetail(user, taskId);
}

// ---------- Assignees (multi-assignee) ----------

export async function assignUser(user: AuthUser, taskId: string, userId: string) {
  const { task, project } = await getTaskContext(user, taskId);
  assertProjectActive(project);
  await assertUsersAreMembers(task.project_id, [userId]);

  const existing = await db
    .selectFrom('task_assignees')
    .select('id')
    .where('task_id', '=', taskId)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  if (existing) throw conflict('User is already assigned to this task');

  await db.transaction().execute(async (trx) => {
    await trx.insertInto('task_assignees').values({ task_id: taskId, user_id: userId, assigned_by_id: user.id }).execute();
    await logEvent(trx, { taskId, actorId: user.id, type: 'ASSIGNED', field: 'assignee', newValue: userId });
  });

  return getTaskDetail(user, taskId);
}

export async function unassignUser(user: AuthUser, taskId: string, userId: string) {
  const { project } = await getTaskContext(user, taskId);
  assertProjectActive(project);

  const deleted = await db.transaction().execute(async (trx) => {
    const res = await trx
      .deleteFrom('task_assignees')
      .where('task_id', '=', taskId)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    if (Number(res.numDeletedRows ?? 0) > 0) {
      await logEvent(trx, { taskId, actorId: user.id, type: 'UNASSIGNED', field: 'assignee', oldValue: userId });
    }
    return Number(res.numDeletedRows ?? 0);
  });
  if (deleted === 0) throw notFound('User is not assigned to this task');

  return getTaskDetail(user, taskId);
}

// ---------- Dependencies ----------

export async function addDependency(user: AuthUser, taskId: string, dependsOnTaskId: string) {
  const { task, project } = await getTaskContext(user, taskId);
  assertProjectActive(project);
  if (taskId === dependsOnTaskId) throw badRequest('A task cannot depend on itself');

  const blocker = await db.selectFrom('tasks').select(['id', 'project_id']).where('id', '=', dependsOnTaskId).executeTakeFirst();
  if (!blocker) throw notFound('Dependency task not found');
  if (blocker.project_id !== task.project_id) throw badRequest('Dependencies must be in the same project');

  const existing = await db
    .selectFrom('task_dependencies')
    .select('id')
    .where('task_id', '=', taskId)
    .where('depends_on_task_id', '=', dependsOnTaskId)
    .executeTakeFirst();
  if (existing) throw conflict('Dependency already exists');

  if (await wouldCreateCycle(task.project_id, taskId, dependsOnTaskId)) {
    throw unprocessable('Adding this dependency would create a cycle');
  }

  await db.transaction().execute(async (trx) => {
    await trx.insertInto('task_dependencies').values({ task_id: taskId, depends_on_task_id: dependsOnTaskId }).execute();
    await logEvent(trx, { taskId, actorId: user.id, type: 'DEPENDENCY_ADDED', field: 'dependency', newValue: dependsOnTaskId });
  });

  return getTaskDetail(user, taskId);
}

export async function removeDependency(user: AuthUser, taskId: string, dependsOnTaskId: string) {
  const { project } = await getTaskContext(user, taskId);
  assertProjectActive(project);

  const res = await db.transaction().execute(async (trx) => {
    const deleted = await trx
      .deleteFrom('task_dependencies')
      .where('task_id', '=', taskId)
      .where('depends_on_task_id', '=', dependsOnTaskId)
      .executeTakeFirst();
    if (Number(deleted.numDeletedRows ?? 0) > 0) {
      await logEvent(trx, { taskId, actorId: user.id, type: 'DEPENDENCY_REMOVED', field: 'dependency', oldValue: dependsOnTaskId });
    }
    return Number(deleted.numDeletedRows ?? 0);
  });
  if (res === 0) throw notFound('Dependency not found');

  return getTaskDetail(user, taskId);
}

// ---------- Helpers ----------

async function unresolvedBlockers(taskId: string) {
  return db
    .selectFrom('task_dependencies as d')
    .innerJoin('tasks as t', 't.id', 'd.depends_on_task_id')
    .select(['t.id', 't.title', 't.status'])
    .where('d.task_id', '=', taskId)
    .where('t.status', 'not in', ['DONE', 'CANCELLED'])
    .execute();
}

async function assertUsersAreMembers(projectId: string, userIds: string[]): Promise<void> {
  const rows = await db
    .selectFrom('project_memberships')
    .select('user_id')
    .where('project_id', '=', projectId)
    .where('user_id', 'in', userIds)
    .execute();
  const members = new Set(rows.map((r) => r.user_id));
  const missing = userIds.filter((id) => !members.has(id));
  if (missing.length > 0) throw badRequest('All assignees must be members of the project', { missing });
}

async function assertTasksInProject(projectId: string, taskIds: string[]): Promise<void> {
  const rows = await db.selectFrom('tasks').select('id').where('project_id', '=', projectId).where('id', 'in', taskIds).execute();
  const found = new Set(rows.map((r) => r.id));
  const missing = taskIds.filter((id) => !found.has(id));
  if (missing.length > 0) throw badRequest('All dependencies must be tasks in the same project', { missing });
}

/**
 * Cycle check: adding "taskId depends on dependsOnTaskId" creates a cycle iff
 * dependsOnTaskId already (transitively) depends on taskId. DFS over the
 * project's dependency edges from dependsOnTaskId looking for taskId.
 */
async function wouldCreateCycle(projectId: string, taskId: string, dependsOnTaskId: string): Promise<boolean> {
  const edges = await db
    .selectFrom('task_dependencies as d')
    .innerJoin('tasks as t', 't.id', 'd.task_id')
    .select(['d.task_id', 'd.depends_on_task_id'])
    .where('t.project_id', '=', projectId)
    .execute();

  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.task_id) ?? [];
    list.push(e.depends_on_task_id);
    adj.set(e.task_id, list);
  }

  const stack = [dependsOnTaskId];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === taskId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const next of adj.get(cur) ?? []) stack.push(next);
  }
  return false;
}
