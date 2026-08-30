import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import projectsRoutes from './modules/projects/projects.routes';
import { tasksRouter } from './modules/tasks/tasks.routes';
import alertsRoutes from './modules/alerts/alerts.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';

/** Root API router — feature modules mount here. */
const api = Router();

api.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

api.use('/auth', authRoutes);
api.use('/users', usersRoutes);
api.use('/projects', projectsRoutes);
api.use('/tasks', tasksRouter);
api.use('/alerts', alertsRoutes);
api.use('/dashboard', dashboardRoutes);

export default api;
