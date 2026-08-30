import { Router } from 'express';
import * as controller from './projects.controller';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/authorize';
import { validateBody, validateQuery } from '../../lib/validate';
import {
  createProjectSchema,
  updateProjectSchema,
  listProjectsQuery,
  addMemberSchema,
} from './projects.schemas';

const router = Router();

router.use(requireAuth);

router.get('/', validateQuery(listProjectsQuery), controller.list);
router.post('/', requireRole('MANAGER'), validateBody(createProjectSchema), controller.create);

router.get('/:projectId', controller.getOne);
router.patch('/:projectId', validateBody(updateProjectSchema), controller.update);
router.post('/:projectId/archive', controller.archive);
router.post('/:projectId/restore', controller.restore);

router.post('/:projectId/members', validateBody(addMemberSchema), controller.addMember);
router.delete('/:projectId/members/:userId', controller.removeMember);

export default router;
