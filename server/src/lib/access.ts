import { db } from '../db';
import type { ProjectRow } from '../db/types';
import type { AuthUser } from '../types/express';
import { forbidden, notFound } from './errors';

/**
 * Central authorization for project-scoped resources. Both middleware and
 * services call these, so every path is guarded by the same server-side rules.
 *
 * Model:
 *  - A MANAGER has oversight of ALL projects (view + manage).
 *  - A MEMBER may only view/act on projects they are a member of.
 *  - Only MANAGERs may create/edit/archive projects and manage membership.
 */

export async function isProjectMember(userId: string, projectId: string): Promise<boolean> {
  const row = await db
    .selectFrom('project_memberships')
    .select('id')
    .where('project_id', '=', projectId)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  return Boolean(row);
}

async function loadProject(projectId: string): Promise<ProjectRow> {
  const project = await db
    .selectFrom('projects')
    .selectAll()
    .where('id', '=', projectId)
    .executeTakeFirst();
  if (!project) throw notFound('Project not found');
  return project;
}

/** Read/participate access: manager (any project) or a member of this project. */
export async function assertProjectAccess(user: AuthUser, projectId: string): Promise<ProjectRow> {
  const project = await loadProject(projectId);
  if (user.role === 'MANAGER') return project;
  if (await isProjectMember(user.id, projectId)) return project;
  throw forbidden('You are not a member of this project');
}

/** Manage access (edit project, membership, destructive ops): managers only. */
export async function assertProjectManage(user: AuthUser, projectId: string): Promise<ProjectRow> {
  const project = await loadProject(projectId);
  if (user.role !== 'MANAGER') throw forbidden('Only managers can manage projects');
  return project;
}

/** Guards that mutate a task require the project not be archived. */
export function assertProjectActive(project: ProjectRow): void {
  if (project.status === 'ARCHIVED') {
    throw forbidden('Project is archived; restore it before making changes');
  }
}
