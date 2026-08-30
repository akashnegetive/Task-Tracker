import express, { type Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './env';
import api from './routes';
import { errorHandler, notFoundHandler } from './middleware/error';

/**
 * Builds the Express application. Kept as a factory (no listen) so tests can
 * import the app and drive it with supertest without opening a port.
 */
export function createApp(): Express {
  const app = express();

  app.use(
    cors({
      origin: env.clientOrigin,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
