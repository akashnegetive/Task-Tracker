import { describe, it, expect, beforeEach } from 'vitest';
import { registerAgent, truncateAll } from './helpers';

beforeEach(truncateAll);

describe('task timeline + comments', () => {
  it('records a chronological, enriched, immutable timeline', async () => {
    const { agent: boss } = await registerAgent('boss@acme.com', 'Boss');
    const { user: dev } = await registerAgent('dev@acme.com', 'Dev');
    const projectId = (await boss.post('/api/projects').send({ name: 'P', memberIds: [dev.id] })).body.project.id;

    const task = (await boss.post(`/api/projects/${projectId}/tasks`).send({ title: 'A' })).body.task;
    await boss.post(`/api/tasks/${task.id}/assignees`).send({ userId: dev.id });
    await boss.post(`/api/tasks/${task.id}/transition`).send({ status: 'IN_PROGRESS' });
    await boss.patch(`/api/tasks/${task.id}`).send({ priority: 'URGENT' });
    await boss.post(`/api/tasks/${task.id}/comments`).send({ body: 'Kicking this off' });

    const timeline = (await boss.get(`/api/tasks/${task.id}/timeline`)).body.timeline;
    const types = timeline.map((e: any) => e.type);
    expect(types).toEqual(['CREATED', 'ASSIGNED', 'STATUS_CHANGED', 'FIELD_CHANGED', 'COMMENTED']);

    // Assignment resolves the user name; the field change carries old/new.
    const assigned = timeline.find((e: any) => e.type === 'ASSIGNED');
    expect(assigned.subjectUser.name).toBe('Dev');
    const changed = timeline.find((e: any) => e.type === 'FIELD_CHANGED');
    expect(changed.field).toBe('priority');
    expect([changed.oldValue, changed.newValue]).toEqual(['MEDIUM', 'URGENT']);
    const comment = timeline.find((e: any) => e.type === 'COMMENTED');
    expect(comment.newValue).toBe('Kicking this off');
    expect(comment.actor.name).toBe('Boss');
  });
});
