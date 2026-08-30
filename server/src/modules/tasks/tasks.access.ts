import { db } from '../../db';
import type { ProjectRow, TaskRow } from '../../db/types';
import type { AuthUser } from '../../types/express';
import { assertProjectAccess } from '../../lib/access';
import { forbidden, notFound } from '../../lib/errors';

export interface TaskContext {
  task: TaskRow;
  project: ProjectRow;
}

/** Loads a task and asserts the user may access its project. */
export async function getTaskContext(user: AuthUser, taskId: string): Promise<TaskContext> {
  const task = await db.selectFrom('tasks').selectAll().where('id', '=', taskId).executeTakeFirst();
  if (!task) throw notFound('Task not found');
  const project = await assertProjectAccess(user, task.project_id);
  return { task, project };
}

/** Is the user an assignee of this task? */
export async function isAssignee(userId: string, taskId: string): Promise<boolean> {
  const row = await db
    .selectFrom('task_assignees')
    .select('id')
    .where('task_id', '=', taskId)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  return Boolean(row);
}

/**
 * Status transitions are restricted to managers and the task's own assignees —
 * a project member who isn't working the task can view and comment but not
 * move it through the lifecycle.
 */
export async function assertCanTransition(user: AuthUser, task: TaskRow): Promise<void> {
  if (user.role === 'MANAGER') return;
  if (await isAssignee(user.id, task.id)) return;
  throw forbidden('Only a manager or an assignee can change this task’s status');
}
