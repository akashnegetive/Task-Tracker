import { db } from '../../db';
import type { AuthUser } from '../../types/express';
import type { TaskStatus, TaskPriority } from '../../db/types';
import { assertProjectAccess } from '../../lib/access';

const STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'];
const PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const OPEN: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW'];
const WEEKS = 8;

export interface Dashboard {
  scope: { projectId: string | null };
  metrics: { total: number; open: number; completed: number; overdue: number; dueSoon: number; completionRate: number };
  byStatus: Record<TaskStatus, number>;
  byPriority: Record<TaskPriority, number>;
  completionByWeek: { weekStart: string; completed: number }[];
}

/** Monday 00:00 UTC of the week containing `d`. */
function mondayUtc(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (x.getUTCDay() + 6) % 7; // 0 = Monday
  x.setUTCDate(x.getUTCDate() - dow);
  return x;
}

/** Resolve which projects the dashboard covers, enforcing access. null = all (manager global). */
async function resolveProjectIds(user: AuthUser, projectId?: string): Promise<string[] | null> {
  if (projectId) {
    await assertProjectAccess(user, projectId);
    return [projectId];
  }
  if (user.role === 'MANAGER') return null; // all projects
  const rows = await db.selectFrom('project_memberships').select('project_id').where('user_id', '=', user.id).execute();
  return rows.map((r) => r.project_id);
}

export async function getDashboard(user: AuthUser, projectId?: string): Promise<Dashboard> {
  const projectIds = await resolveProjectIds(user, projectId);
  // Member with no projects → empty dashboard.
  const restrict = <Q extends { where: (...a: never[]) => Q }>(q: Q): Q =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (projectIds === null ? q : (q as any).where('t.project_id', 'in', projectIds.length ? projectIds : ['00000000-0000-0000-0000-000000000000']));

  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Status & priority breakdowns in two grouped queries.
  const [statusRows, priorityRows, headline, completedRows] = await Promise.all([
    restrict(db.selectFrom('tasks as t').select((eb) => ['t.status', eb.fn.countAll<string>().as('c')]).groupBy('t.status')).execute(),
    restrict(db.selectFrom('tasks as t').select((eb) => ['t.priority', eb.fn.countAll<string>().as('c')]).groupBy('t.priority')).execute(),
    restrict(
      db.selectFrom('tasks as t').select((eb) => [
        eb.fn.countAll<string>().as('total'),
        eb.fn.count<string>('t.id').filterWhere('t.status', 'in', OPEN).as('open'),
        eb.fn.count<string>('t.id').filterWhere('t.status', '=', 'DONE').as('completed'),
      ]),
    ).executeTakeFirst(),
    // Completions within the chart window.
    restrict(
      db
        .selectFrom('tasks as t')
        .select('t.completed_at as completedAt')
        .where('t.completed_at', 'is not', null)
        .where('t.status', '=', 'DONE'),
    ).execute(),
  ]);

  // Overdue & due-soon need date predicates; compute with dedicated counts.
  const overdueRow = await restrict(
    db
      .selectFrom('tasks as t')
      .select((eb) => eb.fn.countAll<string>().as('c'))
      .where('t.status', 'in', OPEN)
      .where('t.due_date', 'is not', null)
      .where('t.due_date', '<', now),
  ).executeTakeFirst();
  const dueSoonRow = await restrict(
    db
      .selectFrom('tasks as t')
      .select((eb) => eb.fn.countAll<string>().as('c'))
      .where('t.status', 'in', OPEN)
      .where('t.due_date', '>=', now)
      .where('t.due_date', '<=', soon),
  ).executeTakeFirst();

  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<TaskStatus, number>;
  for (const r of statusRows) byStatus[r.status] = Number(r.c);
  const byPriority = Object.fromEntries(PRIORITIES.map((p) => [p, 0])) as Record<TaskPriority, number>;
  for (const r of priorityRows) byPriority[r.priority] = Number(r.c);

  // 8-week completion buckets (Mon–Sun), oldest first.
  const currentWeek = mondayUtc(now);
  const buckets = Array.from({ length: WEEKS }, (_, i) => {
    const start = new Date(currentWeek);
    start.setUTCDate(start.getUTCDate() - (WEEKS - 1 - i) * 7);
    return { weekStart: start, end: new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000), completed: 0 };
  });
  for (const row of completedRows) {
    const t = new Date(row.completedAt as Date).getTime();
    const b = buckets.find((bk) => t >= bk.weekStart.getTime() && t < bk.end.getTime());
    if (b) b.completed += 1;
  }

  const total = Number(headline?.total ?? 0);
  const completed = Number(headline?.completed ?? 0);
  return {
    scope: { projectId: projectId ?? null },
    metrics: {
      total,
      open: Number(headline?.open ?? 0),
      completed,
      overdue: Number(overdueRow?.c ?? 0),
      dueSoon: Number(dueSoonRow?.c ?? 0),
      completionRate: total > 0 ? Math.round((completed / total) * 100) / 100 : 0,
    },
    byStatus,
    byPriority,
    completionByWeek: buckets.map((b) => ({ weekStart: b.weekStart.toISOString().slice(0, 10), completed: b.completed })),
  };
}
