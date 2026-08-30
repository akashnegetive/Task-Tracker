import { Router } from 'express';
import * as controller from './auth.controller';
import { validateBody } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import { registerSchema, loginSchema } from './auth.schemas';

const router = Router();

router.post('/register', validateBody(registerSchema), controller.register);
router.post('/login', validateBody(loginSchema), controller.login);
router.post('/logout', controller.logout);
router.get('/me', requireAuth, controller.me);

export default router;
