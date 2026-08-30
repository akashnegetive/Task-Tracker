import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import * as service from './alerts.service';

const router = Router();
router.use(requireAuth);

router.get('/overdue', async (req, res, next) => {
  try {
    const alerts = await service.listOverdue(req.user!);
    res.json({ alerts });
  } catch (err) {
    next(err);
  }
});

router.post('/overdue/:taskId/dismiss', async (req, res, next) => {
  try {
    await service.dismissOverdue(req.user!, req.params.taskId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
