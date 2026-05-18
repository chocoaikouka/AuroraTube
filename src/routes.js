import express from 'express';
import { badRequest, json, notFound } from './http.js';
import { readStaticFile } from './static.js';
import { sanitizeVideoId } from './validation.js';
import { resolveSearch, resolveTrending, resolveWatch } from './resolver.js';
import { candidateWarnings, handleDownloadRequest, handleStreamRequest, pickPlaybackCandidate } from './stream.js';
import { asyncRoute } from './middleware.js';

const isApiPath = (pathname) => String(pathname || '').startsWith('/api/');
const isPageRequest = (req) => req.method === 'GET' || req.method === 'HEAD';

async function sendStaticIndex(res, frontendDistDir) {
  const file = await readStaticFile(frontendDistDir, 'index.html');
  if (!file) {
    json(res, 503, { error: 'frontend_not_built', message: 'The React frontend has not been built yet.' });
    return;
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', file.contentType);
  res.end(file.data);
}

export function registerRoutes(app, frontendDistDir) {
  app.get('/api/trending', asyncRoute(async (_req, res) => {
    const data = await resolveTrending();
    return json(res, data.error ? 502 : 200, data);
  }));

  app.get('/api/search', asyncRoute(async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (!q) return badRequest(res, 'Missing q parameter.');
    if (q.length > 256) return badRequest(res, 'q parameter is too long.');
    const data = await resolveSearch(q);
    return json(res, data.error ? 502 : 200, data);
  }));

  app.get('/api/watch/:videoId', asyncRoute(async (req, res) => {
    const videoId = sanitizeVideoId(req.params.videoId);
    if (!videoId) return badRequest(res, 'Invalid video id.');
    const data = await resolveWatch(videoId);
    const selectedFormat = pickPlaybackCandidate(data.formats, String(req.query.format ?? ''));
    return json(res, data.error ? 502 : 200, {
      ...data,
      selectedFormat,
      proxyPlayback: Boolean(selectedFormat && !selectedFormat.hls),
      proxyWarnings: candidateWarnings(selectedFormat),
      directMode: Boolean(selectedFormat?.hls),
      directUrl: selectedFormat?.hls ? selectedFormat.directUrl : ''
    });
  }));

  app.get('/api/download/:videoId', asyncRoute(async (req, res) => {
    const videoId = sanitizeVideoId(req.params.videoId);
    if (!videoId) return badRequest(res, 'Invalid video id.');
    const watch = await resolveWatch(videoId);
    return handleDownloadRequest({ req, res, video: watch, formats: watch.formats || [], formatId: String(req.query.format ?? '') });
  }));

  app.get('/api/stream/:videoId', asyncRoute(async (req, res) => {
    const videoId = sanitizeVideoId(req.params.videoId);
    if (!videoId) return badRequest(res, 'Invalid video id.');
    const watch = await resolveWatch(videoId);
    return handleStreamRequest({
      req,
      res,
      video: watch,
      formats: watch.formats || [],
      formatId: String(req.query.format ?? ''),
      direct: String(req.query.direct ?? '') === '1' || String(req.query.direct ?? '').toLowerCase() === 'true'
    });
  }));

  app.use(express.static(frontendDistDir, { index: false, fallthrough: true, immutable: true, maxAge: '1y' }));

  app.use(asyncRoute(async (req, res, next) => {
    if (!isPageRequest(req)) return next();
    if (isApiPath(req.path)) return next();
    return sendStaticIndex(res, frontendDistDir);
  }));

  app.use((req, res) => {
    if (isApiPath(req.path)) return notFound(res);
    if (isPageRequest(req)) return sendStaticIndex(res, frontendDistDir);
    return notFound(res);
  });
}
