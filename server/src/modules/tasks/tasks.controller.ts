import type { Request, Response, NextFunction } from 'express';
import * as service from './tasks.service';
import { listTasks, exportTasks, type Scope } from './tasks.list';
import { getTimeline, addComment } from './tasks.timeline';
import { bulkApply } from './tasks.bulk';
import { toCsv } from '../../lib/csv';
import type { ListTasksQuery } from './tasks.schemas';

const u = (req: Request) => req.user!;

export async function bulk(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await bulkApply(u(req), req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function exportCsv(req: Request, res: Response, next: NextFunction, scope: Scope) {
  try {
    const query = res.locals.query as ListTasksQuery;
    const rows = await exportTasks(u(req), scope, query);
    const csv = toCsv(rows, [
      { header: 'id', value: (r) => r.id },
      { header: 'title', value: (r) => r.title },
      { header: 'status', value: (r) => r.status },
      { header: 'priority', value: (r) => r.priority },
      { header: 'assignees', value: (r) => r.assignees.map((a) => a.name).join('; ') },
      { header: 'dueDate', value: (r) => (r.dueDate ? new Date(r.dueDate).toISOString() : '') },
      { header: 'isOverdue', value: (r) => r.isOverdue },
      { header: 'createdAt', value: (r) => new Date(r.createdAt).toISOString() },
      { header: 'completedAt', value: (r) => (r.completedAt ? new Date(r.completedAt).toISOString() : '') },
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="tasks-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

export const exportByProject = (req: Request, res: Response, next: NextFunction) =>
  exportCsv(req, res, next, { kind: 'project', projectId: req.params.projectId });
export const exportMine = (req: Request, res: Response, next: NextFunction) =>
  exportCsv(req, res, next, { kind: 'assignee', userId: req.user!.id });

export async function timeline(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await getTimeline(u(req), req.params.taskId);
    res.json({ timeline: items });
  } catch (err) {
    next(err);
  }
}

export async function comment(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await addComment(u(req), req.params.taskId, req.body.body);
    res.status(201).json({ timeline: items });
  } catch (err) {
    next(err);
  }
}

export async function listByProject(req: Request, res: Response, next: NextFunction) {
  try {
    const query = res.locals.query as ListTasksQuery;
    const result = await listTasks(u(req), { kind: 'project', projectId: req.params.projectId }, query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listMine(req: Request, res: Response, next: NextFunction) {
  try {
    const query = res.locals.query as ListTasksQuery;
    const result = await listTasks(u(req), { kind: 'assignee', userId: u(req).id }, query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await service.createTask(u(req), req.params.projectId, req.body);
    res.status(201).json({ task });
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await service.getTaskDetail(u(req), req.params.taskId);
    res.json({ task });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await service.updateTask(u(req), req.params.taskId, req.body);
    res.json({ task });
  } catch (err) {
    next(err);
  }
}

export async function transition(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await service.transitionTask(u(req), req.params.taskId, req.body.status);
    res.json({ task });
  } catch (err) {
    next(err);
  }
}

export async function assign(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await service.assignUser(u(req), req.params.taskId, req.body.userId);
    res.status(201).json({ task });
  } catch (err) {
    next(err);
  }
}

export async function unassign(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await service.unassignUser(u(req), req.params.taskId, req.params.userId);
    res.json({ task });
  } catch (err) {
    next(err);
  }
}

export async function addDependency(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await service.addDependency(u(req), req.params.taskId, req.body.dependsOnTaskId);
    res.status(201).json({ task });
  } catch (err) {
    next(err);
  }
}

export async function removeDependency(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await service.removeDependency(u(req), req.params.taskId, req.params.depId);
    res.json({ task });
  } catch (err) {
    next(err);
  }
}
