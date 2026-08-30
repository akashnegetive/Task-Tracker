import { db } from '../../db';
import type { AuthUser } from '../../types/express';
import type { TaskEventType } from '../../db/types';
import { assertProjectActive } from '../../lib/access';
import { getTaskContext } from './tasks.access';
import { logEvent } from './tasks.events';

export interface TimelineItem {
  id: string;
  type: TaskEventType;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
  actor: { id: string; name: string } | null;
  // Resolved references for friendly rendering:
  subjectUser?: { id: string; name: string } | null; // ASSIGNED / UNASSIGNED
  subjectTask?: { id: string; title: string } | null; // DEPENDENCY_ADDED / REMOVED
}

/** Immutable, chronological timeline: field changes, status, assignments, deps, comments. */
export async function getTimeline(user: AuthUser, taskId: string): Promise<TimelineItem[]> {
  await getTaskContext(user, taskId); // authorization (read access)

  const events = await db
    .selectFrom('task_events as e')
    .leftJoin('users as a', 'a.id', 'e.actor_id')
    .select(['e.id', 'e.type', 'e.field', 'e.old_value as oldValue', 'e.new_value as newValue', 'e.created_at as createdAt', 'a.id as actorId', 'a.name as actorName'])
    .where('e.task_id', '=', taskId)
    .orderBy('e.created_at', 'asc')
    .orderBy('e.id', 'asc')
    .execute();

  // Collect referenced user/task ids to resolve names in two batch queries.
  const userIds = new Set<string>();
  const taskIds = new Set<string>();
  for (const e of events) {
    if (e.type === 'ASSIGNED' && e.newValue) userIds.add(e.newValue);
    if (e.type === 'UNASSIGNED' && e.oldValue) userIds.add(e.oldValue);
    if (e.type === 'DEPENDENCY_ADDED' && e.newValue) taskIds.add(e.newValue);
    if (e.type === 'DEPENDENCY_REMOVED' && e.oldValue) taskIds.add(e.oldValue);
  }

  const [users, tasks] = await Promise.all([
    userIds.size
      ? db.selectFrom('users').select(['id', 'name']).where('id', 'in', [...userIds]).execute()
      : Promise.resolve([]),
    taskIds.size
      ? db.selectFrom('tasks').select(['id', 'title']).where('id', 'in', [...taskIds]).execute()
      : Promise.resolve([]),
  ]);
  const userMap = new Map(users.map((u) => [u.id, u]));
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  return events.map((e) => {
    const item: TimelineItem = {
      id: e.id,
      type: e.type,
      field: e.field,
      oldValue: e.oldValue,
      newValue: e.newValue,
      createdAt: e.createdAt,
      actor: e.actorId ? { id: e.actorId, name: e.actorName as string } : null,
    };
    if (e.type === 'ASSIGNED' && e.newValue) item.subjectUser = userMap.get(e.newValue) ?? null;
    if (e.type === 'UNASSIGNED' && e.oldValue) item.subjectUser = userMap.get(e.oldValue) ?? null;
    if (e.type === 'DEPENDENCY_ADDED' && e.newValue) item.subjectTask = taskMap.get(e.newValue) ?? null;
    if (e.type === 'DEPENDENCY_REMOVED' && e.oldValue) item.subjectTask = taskMap.get(e.oldValue) ?? null;
    return item;
  });
}

/** Add a comment — stored as an immutable COMMENTED event (body in new_value). */
export async function addComment(user: AuthUser, taskId: string, body: string) {
  const { project } = await getTaskContext(user, taskId);
  assertProjectActive(project);
  await logEvent(db, { taskId, actorId: user.id, type: 'COMMENTED', newValue: body });
  return getTimeline(user, taskId);
}
