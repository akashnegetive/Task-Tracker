import { db } from '../../db';
import type { AuthUser } from '../../types/express';
import type { TaskPriority } from '../../db/types';
import { badRequest, notFound } from '../../lib/errors';

export interface OverdueAlert {
  taskId: string;
  projectId: string;
  title: string;
  priority: TaskPriority;
  dueDate: Date;
  status: string;
  reappeared: boolean; // was dismissed before, but the due date changed
}

const OPEN = ['TODO', 'IN_PROGRESS', 'IN_REVIEW'] as const;

/**
 * Overdue alerts for the current user: open tasks assigned to them whose due
 * date has passed. A task the user dismissed stays hidden *unless* its due date
 * has since changed (rescheduled and still overdue) — then the alert reappears.
 */
export async function listOverdue(user: AuthUser): Promise<OverdueAlert[]> {
  const rows = await db
    .selectFrom('tasks as t')
    .innerJoin('task_assignees as ta', 'ta.task_id', 't.id')
    .leftJoin('overdue_dismissals as od', (join) =>
      join.onRef('od.task_id', '=', 't.id').on('od.user_id', '=', user.id),
    )
    .select([
      't.id as taskId',
      't.project_id as projectId',
      't.title',
      't.priority',
      't.status',
      't.due_date as dueDate',
      'od.due_date_at_dismissal as dismissedFor',
    ])
    .where('ta.user_id', '=', user.id)
    .where('t.status', 'in', OPEN)
    .where('t.due_date', 'is not', null)
    .where('t.due_date', '<', new Date())
    .execute();

  return rows
    .filter((r) => {
      if (r.dismissedFor === null || r.dismissedFor === undefined) return true; // never dismissed
      // Reappears if the due date differs from the one captured at dismissal.
      return new Date(r.dismissedFor).getTime() !== new Date(r.dueDate as Date).getTime();
    })
    .map((r) => ({
      taskId: r.taskId,
      projectId: r.projectId,
      title: r.title,
      priority: r.priority,
      status: r.status,
      dueDate: r.dueDate as Date,
      reappeared: r.dismissedFor != null,
    }));
}

/** Dismiss the overdue alert for a task, capturing its current due date. */
export async function dismissOverdue(user: AuthUser, taskId: string): Promise<void> {
  const task = await db
    .selectFrom('tasks as t')
    .innerJoin('task_assignees as ta', 'ta.task_id', 't.id')
    .select(['t.id', 't.due_date as dueDate', 't.status'])
    .where('t.id', '=', taskId)
    .where('ta.user_id', '=', user.id)
    .executeTakeFirst();

  if (!task) throw notFound('No overdue task assigned to you with that id');
  if (task.dueDate === null) throw badRequest('Task has no due date');

  await db
    .insertInto('overdue_dismissals')
    .values({ task_id: taskId, user_id: user.id, due_date_at_dismissal: task.dueDate as Date })
    .onConflict((oc) =>
      oc.columns(['task_id', 'user_id']).doUpdateSet({
        due_date_at_dismissal: task.dueDate as Date,
        dismissed_at: new Date(),
      }),
    )
    .execute();
}
