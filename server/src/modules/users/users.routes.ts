import { Router } from 'express';
import { db } from '../../db';
import { requireAuth } from '../../middleware/auth';

const router = Router();

router.use(requireAuth);

/** List users — used by membership and assignee pickers. */
router.get('/', async (req, res, next) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    let q = db.selectFrom('users').select(['id', 'name', 'email', 'role']).orderBy('name');
    if (search) {
      q = q.where((eb) =>
        eb.or([eb('name', 'ilike', `%${search}%`), eb('email', 'ilike', `%${search}%`)]),
      );
    }
    const users = await q.execute();
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

export default router;
