import { describe, it, expect, beforeEach } from 'vitest';
import { registerAgent, truncateAll } from './helpers';
import type TestAgent from 'supertest/lib/agent';

beforeEach(truncateAll);

async function setup() {
  const { agent: boss } = await registerAgent('boss@acme.com', 'Boss');
  const { agent: dev, user: devUser } = await registerAgent('dev@acme.com', 'Dev');
  const project = (await boss.post('/api/projects').send({ name: 'P', memberIds: [devUser.id] })).body.project;
  return { boss, dev, devUser, projectId: project.id as string };
}

const createTask = (agent: TestAgent, projectId: string, body: Record<string, unknown>) =>
  agent.post(`/api/projects/${projectId}/tasks`).send(body);

describe('task lifecycle', () => {
  it('enforces valid transitions and rejects illegal ones (422)', async () => {
    const { boss, projectId } = await setup();
    const task = (await createTask(boss, projectId, { title: 'A' })).body.task;

    expect((await boss.post(`/api/tasks/${task.id}/transition`).send({ status: 'DONE' })).status).toBe(422);

    const ok = await boss.post(`/api/tasks/${task.id}/transition`).send({ status: 'IN_PROGRESS' });
    expect(ok.status).toBe(200);
    expect(ok.body.task.status).toBe('IN_PROGRESS');
  });

  it('sets completed_at on DONE and clears it on reopen', async () => {
    const { boss, projectId } = await setup();
    const task = (await createTask(boss, projectId, { title: 'A' })).body.task;
    for (const s of ['IN_PROGRESS', 'IN_REVIEW', 'DONE']) {
      await boss.post(`/api/tasks/${task.id}/transition`).send({ status: s });
    }
    const done = (await boss.get(`/api/tasks/${task.id}`)).body.task;
    expect(done.status).toBe('DONE');
    expect(done.completedAt).not.toBeNull();

    const reopened = await boss.post(`/api/tasks/${task.id}/transition`).send({ status: 'IN_PROGRESS' });
    expect(reopened.body.task.completedAt).toBeNull();
  });

  it('restricts transitions to managers and assignees (403 for others)', async () => {
    const { boss, dev, devUser, projectId } = await setup();
    // Task with no assignees → dev (member, not assignee) cannot transition.
    const task = (await createTask(boss, projectId, { title: 'A' })).body.task;
    expect((await dev.post(`/api/tasks/${task.id}/transition`).send({ status: 'IN_PROGRESS' })).status).toBe(403);

    // Assign dev → now allowed.
    await boss.post(`/api/tasks/${task.id}/assignees`).send({ userId: devUser.id });
    expect((await dev.post(`/api/tasks/${task.id}/transition`).send({ status: 'IN_PROGRESS' })).status).toBe(200);
  });
});

describe('blocking dependencies', () => {
  it('blocks starting a task until its dependency is DONE (422)', async () => {
    const { boss, projectId } = await setup();
    const a = (await createTask(boss, projectId, { title: 'A' })).body.task;
    const b = (await createTask(boss, projectId, { title: 'B', dependencyIds: [a.id] })).body.task;

    expect((await boss.get(`/api/tasks/${b.id}`)).body.task.isBlocked).toBe(true);

    const blocked = await boss.post(`/api/tasks/${b.id}/transition`).send({ status: 'IN_PROGRESS' });
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.details.blockedBy[0].id).toBe(a.id);

    for (const s of ['IN_PROGRESS', 'IN_REVIEW', 'DONE']) {
      await boss.post(`/api/tasks/${a.id}/transition`).send({ status: s });
    }
    expect((await boss.post(`/api/tasks/${b.id}/transition`).send({ status: 'IN_PROGRESS' })).status).toBe(200);
  });

  it('prevents dependency cycles (422)', async () => {
    const { boss, projectId } = await setup();
    const a = (await createTask(boss, projectId, { title: 'A' })).body.task;
    const b = (await createTask(boss, projectId, { title: 'B', dependencyIds: [a.id] })).body.task;
    // A depends on B would close the loop.
    const res = await boss.post(`/api/tasks/${a.id}/dependencies`).send({ dependsOnTaskId: b.id });
    expect(res.status).toBe(422);
  });
});

describe('search / filter / sort / pagination + my tasks', () => {
  async function seedTasks() {
    const ctx = await setup();
    const { boss, devUser, projectId } = ctx;
    await createTask(boss, projectId, { title: 'Design login page', priority: 'HIGH', assigneeIds: [devUser.id], dueDate: '2020-01-01' });
    await createTask(boss, projectId, { title: 'Build API', priority: 'URGENT', assigneeIds: [devUser.id] });
    await createTask(boss, projectId, { title: 'Write docs', priority: 'LOW' });
    await createTask(boss, projectId, { title: 'Setup CI', priority: 'MEDIUM' });
    await createTask(boss, projectId, { title: 'Login bug fix', priority: 'HIGH', assigneeIds: [devUser.id] });
    return ctx;
  }

  it('paginates with correct meta', async () => {
    const { boss, projectId } = await seedTasks();
    const res = await boss.get(`/api/projects/${projectId}/tasks?pageSize=2&page=1`);
    expect(res.body.total).toBe(5);
    expect(res.body.totalPages).toBe(3);
    expect(res.body.items).toHaveLength(2);
  });

  it('searches title/description', async () => {
    const { boss, projectId } = await seedTasks();
    const res = await boss.get(`/api/projects/${projectId}/tasks?search=login`);
    const titles = res.body.items.map((t: any) => t.title).sort();
    expect(titles).toEqual(['Design login page', 'Login bug fix']);
  });

  it('filters by priority and sorts by severity', async () => {
    const { boss, projectId } = await seedTasks();
    const res = await boss.get(`/api/projects/${projectId}/tasks?priority=HIGH,URGENT&sort=priority&order=desc`);
    const priorities = res.body.items.map((t: any) => t.priority);
    expect(priorities[0]).toBe('URGENT');
    expect(res.body.total).toBe(3);
  });

  it('filters overdue', async () => {
    const { boss, projectId } = await seedTasks();
    const res = await boss.get(`/api/projects/${projectId}/tasks?overdue=true`);
    expect(res.body.items.map((t: any) => t.title)).toEqual(['Design login page']);
  });

  it('returns only my assigned tasks in /tasks/mine', async () => {
    const { dev } = await seedTasks();
    const res = await dev.get('/api/tasks/mine?sort=title&order=asc');
    expect(res.body.total).toBe(3);
    expect(res.body.items.every((t: any) => t.assignees.some((a: any) => a.name === 'Dev'))).toBe(true);
  });
});

describe('immutable history', () => {
  it('records events and the DB rejects tampering', async () => {
    const { boss, projectId } = await setup();
    const task = (await createTask(boss, projectId, { title: 'A' })).body.task;
    await boss.post(`/api/tasks/${task.id}/transition`).send({ status: 'IN_PROGRESS' });

    const { pool } = await import('../src/db');
    const { rows } = await pool.query('SELECT count(*)::int AS c FROM task_events WHERE task_id=$1', [task.id]);
    expect(rows[0].c).toBeGreaterThanOrEqual(2); // CREATED + STATUS_CHANGED

    await expect(pool.query('UPDATE task_events SET new_value=$1', ['x'])).rejects.toThrow();
  });
});
