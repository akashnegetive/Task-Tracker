import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { getDashboard } from './dashboard.service';

const router = Router();
router.use(requireAuth);

// GET /api/dashboard        → across accessible projects
// GET /api/dashboard?projectId=... → a single project
router.get('/', async (req, res, next) => {
  try {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    const dashboard = await getDashboard(req.user!, projectId);
    res.json({ dashboard });
  } catch (err) {
    next(err);
  }
});

export default router;
