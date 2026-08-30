import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes';

/** Root API router — feature modules mount here. */
const api = Router();

api.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

api.use('/auth', authRoutes);

export default api;
