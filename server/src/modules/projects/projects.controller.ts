import type { Request, Response, NextFunction } from 'express';
import * as service from './projects.service';
import type { ListProjectsQuery } from './projects.schemas';

const u = (req: Request) => req.user!;

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.createProject(u(req), req.body);
    const project = await service.getProject(u(req), result.id);
    res.status(201).json({ project });
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = res.locals.query as ListProjectsQuery;
    const projects = await service.listProjects(u(req), query);
    res.json({ projects });
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await service.getProject(u(req), req.params.projectId);
    res.json({ project });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await service.updateProject(u(req), req.params.projectId, req.body);
    res.json({ project });
  } catch (err) {
    next(err);
  }
}

export async function archive(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await service.archiveProject(u(req), req.params.projectId);
    res.json({ project });
  } catch (err) {
    next(err);
  }
}

export async function restore(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await service.restoreProject(u(req), req.params.projectId);
    res.json({ project });
  } catch (err) {
    next(err);
  }
}

export async function addMember(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await service.addMember(u(req), req.params.projectId, req.body.userId);
    res.status(201).json({ project });
  } catch (err) {
    next(err);
  }
}

export async function removeMember(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await service.removeMember(u(req), req.params.projectId, req.params.userId);
    res.json({ project });
  } catch (err) {
    next(err);
  }
}
