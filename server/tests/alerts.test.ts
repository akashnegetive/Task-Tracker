import { describe, it, expect, beforeEach } from 'vitest';
import { registerAgent, truncateAll } from './helpers';

beforeEach(truncateAll);

describe('overdue alerts', () => {
  it('shows, dismisses, and reappears when the due date changes', async () => {
    const { agent: boss } = await registerAgent('boss@acme.com', 'Boss');
    const { agent: dev, user: devUser } = await registerAgent('dev@acme.com', 'Dev');
    const projectId = (await boss.post('/api/projects').send({ name: 'P', memberIds: [devUser.id] })).body.project.id;

    const task = (
      await boss.post(`/api/projects/${projectId}/tasks`).send({ title: 'Overdue', assigneeIds: [devUser.id], dueDate: '2020-01-01' })
    ).body.task;

    // 1. Appears
    let alerts = (await dev.get('/api/alerts/overdue')).body.alerts;
    expect(alerts.map((a: any) => a.taskId)).toContain(task.id);
    expect(alerts.find((a: any) => a.taskId === task.id).reappeared).toBe(false);

    // 2. Dismiss → hidden
    expect((await dev.post(`/api/alerts/overdue/${task.id}/dismiss`)).status).toBe(200);
    alerts = (await dev.get('/api/alerts/overdue')).body.alerts;
    expect(alerts.map((a: any) => a.taskId)).not.toContain(task.id);

    // 3. Reschedule to a different (still past) date → alert reappears
    await boss.patch(`/api/tasks/${task.id}`).send({ dueDate: '2019-06-01' });
    alerts = (await dev.get('/api/alerts/overdue')).body.alerts;
    const again = alerts.find((a: any) => a.taskId === task.id);
    expect(again).toBeTruthy();
    expect(again.reappeared).toBe(true);

    // 4. Reschedule to the future → no longer overdue
    await boss.patch(`/api/tasks/${task.id}`).send({ dueDate: '2999-01-01' });
    alerts = (await dev.get('/api/alerts/overdue')).body.alerts;
    expect(alerts.map((a: any) => a.taskId)).not.toContain(task.id);
  });

  it('does not alert once the task is completed', async () => {
    const { agent: boss } = await registerAgent('boss@acme.com', 'Boss');
    const { user: devUser } = await registerAgent('dev@acme.com', 'Dev');
    const projectId = (await boss.post('/api/projects').send({ name: 'P', memberIds: [devUser.id] })).body.project.id;
    const task = (
      await boss.post(`/api/projects/${projectId}/tasks`).send({ title: 'X', assigneeIds: [devUser.id], dueDate: '2020-01-01' })
    ).body.task;
    for (const s of ['IN_PROGRESS', 'IN_REVIEW', 'DONE']) {
      await boss.post(`/api/tasks/${task.id}/transition`).send({ status: s });
    }
    const bossAlerts = (await boss.get('/api/alerts/overdue')).body.alerts;
    expect(bossAlerts).toHaveLength(0);
  });
});
