export function requestSummary(req) {
  return { method: req.method, path: req.originalUrl || req.url, ip: req.ip };
}

export function applyApiNoStore(req, res, next) {
  if ((req.path || '').startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
}

export function logRequests(log, req, _res, next) {
  log.info('request', requestSummary(req));
  next();
}

export function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
