import { Router } from 'express';
import * as controller from './tasks.controller';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../lib/validate';
import {
  createTaskSchema,
  updateTaskSchema,
  transitionSchema,
  assignSchema,
  addDependencySchema,
} from './tasks.schemas';

/** Mounted at /api/projects/:projectId/tasks (mergeParams to see :projectId). */
export const projectTasksRouter = Router({ mergeParams: true });
projectTasksRouter.post('/', validateBody(createTaskSchema), controller.create);

/** Mounted at /api/tasks — operations on a single task. */
export const tasksRouter = Router();
tasksRouter.use(requireAuth);
tasksRouter.get('/:taskId', controller.getOne);
tasksRouter.patch('/:taskId', validateBody(updateTaskSchema), controller.update);
tasksRouter.post('/:taskId/transition', validateBody(transitionSchema), controller.transition);
tasksRouter.post('/:taskId/assignees', validateBody(assignSchema), controller.assign);
tasksRouter.delete('/:taskId/assignees/:userId', controller.unassign);
tasksRouter.post('/:taskId/dependencies', validateBody(addDependencySchema), controller.addDependency);
tasksRouter.delete('/:taskId/dependencies/:depId', controller.removeDependency);
