import { describe, it, expect, beforeEach } from 'vitest';
import { registerAgent, truncateAll } from './helpers';

beforeEach(truncateAll);

async function setup() {
  const { agent: boss } = await registerAgent('boss@acme.com', 'Boss');
  const { user: dev } = await registerAgent('dev@acme.com', 'Dev');
  const projectId = (await boss.post('/api/projects').send({ name: 'P', memberIds: [dev.id] })).body.project.id;
  return { boss, devId: dev.id as string, projectId };
}
const mk = (agent: any, pid: string, body: any) => agent.post(`/api/projects/${pid}/tasks`).send(body);

describe('bulk operations', () => {
  it('reports per-task success and failure independently', async () => {
    const { boss, projectId } = await setup();
    const a = (await mk(boss, projectId, { title: 'A' })).body.task; // TODO
    const b = (await mk(boss, projectId, { title: 'B' })).body.task; // TODO
    const c = (await mk(boss, projectId, { title: 'C', dependencyIds: [a.id] })).body.task; // blocked

    // Bulk transition all three to IN_PROGRESS: A,B succeed; C fails (blocked by A).
    const res = await boss.post('/api/tasks/bulk').send({
      taskIds: [a.id, b.id, c.id],
      operation: { type: 'transition', status: 'IN_PROGRESS' },
    });
    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ total: 3, succeeded: 2, failed: 1 });
    const failed = res.body.results.find((r: any) => !r.success);
    expect(failed.taskId).toBe(c.id);
    expect(failed.error.code).toBe('UNPROCESSABLE');
  });

  it('bulk sets priority across tasks', async () => {
    const { boss, projectId } = await setup();
    const a = (await mk(boss, projectId, { title: 'A' })).body.task;
    const b = (await mk(boss, projectId, { title: 'B' })).body.task;
    const res = await boss.post('/api/tasks/bulk').send({
      taskIds: [a.id, b.id],
      operation: { type: 'setPriority', priority: 'URGENT' },
    });
    expect(res.body.summary.succeeded).toBe(2);
    expect((await boss.get(`/api/tasks/${a.id}`)).body.task.priority).toBe('URGENT');
  });
});

describe('CSV export', () => {
  it('exports filtered tasks as CSV with headers and escaping', async () => {
    const { boss, projectId } = await setup();
    await mk(boss, projectId, { title: 'Normal task', priority: 'HIGH' });
    await mk(boss, projectId, { title: 'Task, with comma', priority: 'LOW' });

    const res = await boss.get(`/api/projects/${projectId}/tasks/export`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const lines = res.text.trim().split('\r\n');
    expect(lines[0]).toBe('id,title,status,priority,assignees,dueDate,isOverdue,createdAt,completedAt');
    expect(res.text).toContain('"Task, with comma"'); // comma-containing cell is quoted
    expect(lines).toHaveLength(3); // header + 2 rows
  });
});
