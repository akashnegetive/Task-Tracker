import { db } from '../../db';
import type { AuthUser } from '../../types/express';
import { assertProjectAccess, assertProjectManage } from '../../lib/access';
import { badRequest, conflict, notFound } from '../../lib/errors';
import type { CreateProjectInput, UpdateProjectInput, ListProjectsQuery } from './projects.schemas';

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  status: string;
  createdById: string;
  createdAt: Date;
  archivedAt: Date | null;
  memberCount: number;
  taskCount: number;
  openTaskCount: number;
}

/** Create a project; the creator and any seeded members are added as members. */
export async function createProject(user: AuthUser, input: CreateProjectInput): Promise<{ id: string }> {
  return db.transaction().execute(async (trx) => {
    const project = await trx
      .insertInto('projects')
      .values({ name: input.name, description: input.description, created_by_id: user.id })
      .returning('id')
      .executeTakeFirstOrThrow();

    const memberIds = new Set<string>([user.id, ...input.memberIds]);
    await trx
      .insertInto('project_memberships')
      .values([...memberIds].map((userId) => ({ project_id: project.id, user_id: userId })))
      .execute();

    return { id: project.id };
  });
}

export async function listProjects(user: AuthUser, query: ListProjectsQuery): Promise<ProjectSummary[]> {
  let q = db
    .selectFrom('projects as p')
    .select((eb) => [
      'p.id',
      'p.name',
      'p.description',
      'p.status',
      'p.created_by_id as createdById',
      'p.created_at as createdAt',
      'p.archived_at as archivedAt',
      eb
        .selectFrom('project_memberships as m')
        .select((e) => e.fn.countAll<string>().as('c'))
        .whereRef('m.project_id', '=', 'p.id')
        .as('memberCount'),
      eb
        .selectFrom('tasks as t')
        .select((e) => e.fn.countAll<string>().as('c'))
        .whereRef('t.project_id', '=', 'p.id')
        .as('taskCount'),
      eb
        .selectFrom('tasks as t')
        .select((e) => e.fn.countAll<string>().as('c'))
        .whereRef('t.project_id', '=', 'p.id')
        .where('t.status', 'not in', ['DONE', 'CANCELLED'])
        .as('openTaskCount'),
    ])
    .orderBy('p.created_at', 'desc');

  // MEMBERs only see projects they belong to; MANAGERs see all.
  if (user.role !== 'MANAGER') {
    q = q.where((eb) =>
      eb.exists(
        eb
          .selectFrom('project_memberships as m')
          .select('m.id')
          .whereRef('m.project_id', '=', 'p.id')
          .where('m.user_id', '=', user.id),
      ),
    );
  }

  if (query.status !== 'ALL') q = q.where('p.status', '=', query.status);
  if (query.search) q = q.where('p.name', 'ilike', `%${query.search}%`);

  const rows = await q.execute();
  return rows.map((r) => ({
    ...r,
    memberCount: Number(r.memberCount ?? 0),
    taskCount: Number(r.taskCount ?? 0),
    openTaskCount: Number(r.openTaskCount ?? 0),
  }));
}

export async function getProject(user: AuthUser, projectId: string) {
  const project = await assertProjectAccess(user, projectId);
  const members = await db
    .selectFrom('project_memberships as m')
    .innerJoin('users as u', 'u.id', 'm.user_id')
    .select(['u.id', 'u.name', 'u.email', 'u.role', 'm.created_at as joinedAt'])
    .where('m.project_id', '=', projectId)
    .orderBy('u.name')
    .execute();

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    createdById: project.created_by_id,
    createdAt: project.created_at,
    archivedAt: project.archived_at,
    members,
  };
}

export async function updateProject(user: AuthUser, projectId: string, input: UpdateProjectInput) {
  await assertProjectManage(user, projectId);
  await db
    .updateTable('projects')
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      updated_at: new Date(),
    })
    .where('id', '=', projectId)
    .execute();
  return getProject(user, projectId);
}

export async function archiveProject(user: AuthUser, projectId: string) {
  const project = await assertProjectManage(user, projectId);
  if (project.status === 'ARCHIVED') throw conflict('Project is already archived');
  await db
    .updateTable('projects')
    .set({ status: 'ARCHIVED', archived_at: new Date(), updated_at: new Date() })
    .where('id', '=', projectId)
    .execute();
  return getProject(user, projectId);
}

export async function restoreProject(user: AuthUser, projectId: string) {
  const project = await assertProjectManage(user, projectId);
  if (project.status === 'ACTIVE') throw conflict('Project is already active');
  await db
    .updateTable('projects')
    .set({ status: 'ACTIVE', archived_at: null, updated_at: new Date() })
    .where('id', '=', projectId)
    .execute();
  return getProject(user, projectId);
}

export async function addMember(user: AuthUser, projectId: string, userId: string) {
  await assertProjectManage(user, projectId);
  const target = await db.selectFrom('users').select('id').where('id', '=', userId).executeTakeFirst();
  if (!target) throw notFound('User not found');

  const already = await db
    .selectFrom('project_memberships')
    .select('id')
    .where('project_id', '=', projectId)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  if (already) throw conflict('User is already a member');

  await db.insertInto('project_memberships').values({ project_id: projectId, user_id: userId }).execute();
  return getProject(user, projectId);
}

export async function removeMember(user: AuthUser, projectId: string, userId: string) {
  const project = await assertProjectManage(user, projectId);
  if (userId === project.created_by_id) throw badRequest('Cannot remove the project owner');

  const res = await db
    .deleteFrom('project_memberships')
    .where('project_id', '=', projectId)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  if (Number(res.numDeletedRows ?? 0) === 0) throw notFound('User is not a member of this project');

  return getProject(user, projectId);
}
