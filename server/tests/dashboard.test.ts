import { describe, it, expect, beforeEach } from 'vitest';
import { registerAgent, truncateAll } from './helpers';

beforeEach(truncateAll);

describe('dashboard', () => {
  it('computes metrics, breakdowns and an 8-week completion chart', async () => {
    const { agent: boss } = await registerAgent('boss@acme.com', 'Boss');
    const { user: dev } = await registerAgent('dev@acme.com', 'Dev');
    const projectId = (await boss.post('/api/projects').send({ name: 'P', memberIds: [dev.id] })).body.project.id;

    const mk = (b: any) => boss.post(`/api/projects/${projectId}/tasks`).send(b).then((r) => r.body.task);
    const t1 = await mk({ title: 'T1', priority: 'HIGH' });
    const t2 = await mk({ title: 'T2', priority: 'HIGH' });
    await mk({ title: 'T3', priority: 'LOW', dueDate: '2020-01-01' }); // overdue, open
    await mk({ title: 'T4', priority: 'URGENT' });

    // Complete t1 and t2 (this week).
    for (const t of [t1, t2]) {
      for (const s of ['IN_PROGRESS', 'IN_REVIEW', 'DONE']) {
        await boss.post(`/api/tasks/${t.id}/transition`).send({ status: s });
      }
    }

    const d = (await boss.get(`/api/dashboard?projectId=${projectId}`)).body.dashboard;
    expect(d.metrics.total).toBe(4);
    expect(d.metrics.completed).toBe(2);
    expect(d.metrics.open).toBe(2);
    expect(d.metrics.overdue).toBe(1);
    expect(d.metrics.completionRate).toBe(0.5);

    expect(d.byStatus.DONE).toBe(2);
    expect(d.byStatus.TODO).toBe(2);
    expect(d.byPriority.HIGH).toBe(2);
    expect(d.byPriority.URGENT).toBe(1);

    expect(d.completionByWeek).toHaveLength(8);
    // Two completions land in the current (last) week bucket.
    expect(d.completionByWeek[7].completed).toBe(2);
    expect(d.completionByWeek.slice(0, 7).reduce((a: number, w: any) => a + w.completed, 0)).toBe(0);
  });

  it('a member sees only their projects in the global dashboard', async () => {
    const { agent: boss } = await registerAgent('boss@acme.com', 'Boss');
    const { agent: dev, user: devUser } = await registerAgent('dev@acme.com', 'Dev');
    // Project the member is NOT in.
    const secret = (await boss.post('/api/projects').send({ name: 'Secret' })).body.project.id;
    await boss.post(`/api/projects/${secret}/tasks`).send({ title: 'hidden' });
    // Project the member IS in.
    const shared = (await boss.post('/api/projects').send({ name: 'Shared', memberIds: [devUser.id] })).body.project.id;
    await boss.post(`/api/projects/${shared}/tasks`).send({ title: 'visible' });

    const d = (await dev.get('/api/dashboard')).body.dashboard;
    expect(d.metrics.total).toBe(1);
  });
});
