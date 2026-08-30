import { describe, it, expect, beforeEach } from 'vitest';
import { app, request, registerAgent, truncateAll } from './helpers';

beforeEach(truncateAll);

describe('auth + roles', () => {
  it('makes the first user a MANAGER and later signups MEMBERs', async () => {
    const { user: boss } = await registerAgent('boss@acme.com', 'Boss');
    const { user: dev } = await registerAgent('dev@acme.com', 'Dev');
    expect(boss.role).toBe('MANAGER');
    expect(dev.role).toBe('MEMBER');
  });

  it('rejects duplicate email (409) and bad credentials (401)', async () => {
    await registerAgent('boss@acme.com', 'Boss');
    const dup = await request(app)
      .post('/api/auth/register')
      .send({ email: 'boss@acme.com', password: 'password123', name: 'X' });
    expect(dup.status).toBe(409);

    const bad = await request(app)
      .post('/api/auth/login')
      .send({ email: 'boss@acme.com', password: 'wrong' });
    expect(bad.status).toBe(401);
  });

  it('requires auth for /me', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('projects + authorization', () => {
  it('lets managers create projects but forbids members (403)', async () => {
    const { agent: boss } = await registerAgent('boss@acme.com', 'Boss');
    const { agent: dev } = await registerAgent('dev@acme.com', 'Dev');

    const created = await boss.post('/api/projects').send({ name: 'Website' });
    expect(created.status).toBe(201);

    const forbidden = await dev.post('/api/projects').send({ name: 'Nope' });
    expect(forbidden.status).toBe(403);
  });

  it('scopes visibility: members only see projects they belong to', async () => {
    const { agent: boss } = await registerAgent('boss@acme.com', 'Boss');
    const { agent: dev, user: devUser } = await registerAgent('dev@acme.com', 'Dev');
    const { agent: outsider } = await registerAgent('out@acme.com', 'Out');

    const proj = (await boss.post('/api/projects').send({ name: 'P', memberIds: [devUser.id] })).body.project;

    expect((await dev.get('/api/projects')).body.projects.map((p: any) => p.id)).toContain(proj.id);
    expect((await outsider.get('/api/projects')).body.projects).toHaveLength(0);
    expect((await outsider.get(`/api/projects/${proj.id}`)).status).toBe(403);
  });

  it('archives and restores (soft), and hides archived from default list', async () => {
    const { agent: boss } = await registerAgent('boss@acme.com', 'Boss');
    const proj = (await boss.post('/api/projects').send({ name: 'P' })).body.project;

    const archived = await boss.post(`/api/projects/${proj.id}/archive`);
    expect(archived.body.project.status).toBe('ARCHIVED');
    expect((await boss.get('/api/projects?status=ACTIVE')).body.projects).toHaveLength(0);
    expect((await boss.get('/api/projects?status=ALL')).body.projects).toHaveLength(1);

    const restored = await boss.post(`/api/projects/${proj.id}/restore`);
    expect(restored.body.project.status).toBe('ACTIVE');
  });

  it('forbids a member from archiving (403)', async () => {
    const { agent: boss } = await registerAgent('boss@acme.com', 'Boss');
    const { agent: dev, user: devUser } = await registerAgent('dev@acme.com', 'Dev');
    const proj = (await boss.post('/api/projects').send({ name: 'P', memberIds: [devUser.id] })).body.project;
    expect((await dev.post(`/api/projects/${proj.id}/archive`)).status).toBe(403);
  });
});
