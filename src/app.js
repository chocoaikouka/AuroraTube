import express from './lib/miniExpress.js';
import path from 'node:path';
import { apiRouter } from './routes/api.js';
import { settings } from './settings.js';

const SPA_ROUTES = ['/', '/results', '/trending', '/search', '/watch', '/watch/:slug', '/shorts', '/shorts/:slug', '/channel', '/channel/:slug'];

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  app.use('/api', apiRouter);
  app.use(express.static(settings.publicDir, { extensions: ['html'], index: false, maxAge: '1h' }));

  app.get(SPA_ROUTES, async (_req, res) => {
    await res.sendFile(path.join(settings.publicDir, 'index.html'));
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'not found' });
  });

  return app;
};
