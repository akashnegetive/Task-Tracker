import type { Request, Response, NextFunction } from 'express';
import * as service from './tasks.service';
import { listTasks } from './tasks.list';
import type { ListTasksQuery } from './tasks.schemas';

const u = (req: Request) => req.user!;

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
