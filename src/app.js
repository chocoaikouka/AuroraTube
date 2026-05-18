import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { APP_NAME, config } from './config.js';
import { purgeExpired } from './cache.js';
import { json } from './http.js';
import { applyApiNoStore, logRequests } from './middleware.js';
import { registerRoutes } from './routes.js';
import { log } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistDir = path.join(__dirname, '..', 'frontend', 'dist');

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(applyApiNoStore);
  app.use((req, res, next) => logRequests(log, req, res, next));
  registerRoutes(app, frontendDistDir);

  app.use((error, req, res, _next) => {
    log.error('unhandled request error', { error, method: req.method, path: req.originalUrl || req.url, ip: req.ip });
    if (res.headersSent) {
      res.destroy(error);
      return;
    }
    json(res, 500, { error: 'internal_error', message: 'An internal server error occurred.' });
  });

  return app;
}

export function startServer() {
  const app = createApp();
  const server = app.listen(config.port, () => {
    log.info('server started', { port: config.port, name: APP_NAME });
  });

  setInterval(() => purgeExpired(config.cacheTtlMs).catch(() => {}), Math.max(30_000, config.cacheTtlMs)).unref();
  return server;
}
