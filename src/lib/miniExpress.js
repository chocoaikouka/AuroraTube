import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';

const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
const DEFAULT_LIMIT_BYTES = 1024 * 1024;

const mimeTypeFor = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8';
    case '.js': return 'text/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.svg': return 'image/svg+xml';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    case '.ico': return 'image/x-icon';
    case '.txt': return 'text/plain; charset=utf-8';
    default: return 'application/octet-stream';
  }
};

const compilePath = (pattern) => {
  if (pattern === '*' || pattern === '/*') return { regex: /^.*$/, keys: [] };
  const segments = String(pattern || '/').split('/').filter(Boolean);
  const keys = [];
  const regexParts = segments.map((segment) => {
    if (segment.startsWith(':')) {
      keys.push(segment.slice(1));
      return '([^/]+)';
    }
    return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  const regex = new RegExp(`^/${regexParts.join('/')}/?$`);
  return { regex, keys };
};

const matchPath = (pathname, pattern, { prefix = false } = {}) => {
  if (Array.isArray(pattern)) {
    for (const entry of pattern) {
      const match = matchPath(pathname, entry, { prefix });
      if (match) return match;
    }
    return null;
  }

  if (pattern === undefined || pattern === null || pattern === '/' || pattern === '') {
    return { params: {} };
  }

  const stringPattern = String(pattern);
  if (!stringPattern.includes(':')) {
    const trimmed = stringPattern !== '/' ? stringPattern.replace(/\/+$/u, '') : '/';
    const current = pathname !== '/' ? pathname.replace(/\/+$/u, '') : '/';
    if (current === trimmed) return { params: {} };
    if (prefix && trimmed !== '/' && current.startsWith(`${trimmed}/`)) return { params: {} };
    return null;
  }

  const { regex, keys } = compilePath(stringPattern);
  const result = pathname.match(regex);
  if (!result) return null;
  const params = {};
  keys.forEach((key, index) => { params[key] = decodeURIComponent(result[index + 1] || ''); });
  return { params };
};

const isPromise = (value) => Boolean(value) && typeof value.then === 'function';

const limitToBytes = (limit) => {
  if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) return limit;
  if (typeof limit !== 'string') return DEFAULT_LIMIT_BYTES;
  const text = limit.trim().toLowerCase();
  const match = text.match(/^(\d+(?:\.\d+)?)(b|kb|mb|gb)?$/);
  if (!match) return DEFAULT_LIMIT_BYTES;
  const amount = Number(match[1]);
  const unit = match[2] || 'b';
  const multiplier = unit === 'gb' ? 1024 ** 3 : unit === 'mb' ? 1024 ** 2 : unit === 'kb' ? 1024 : 1;
  return Math.max(1, Math.floor(amount * multiplier));
};

const readBody = async (req, limitBytes) => {
  if (req.method === 'GET' || req.method === 'HEAD') return '';
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > limitBytes) {
      const error = new Error('request entity too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString('utf8');
};

const enhanceResponse = (res) => {
  if (res.__miniExpressEnhanced) return res;
  res.__miniExpressEnhanced = true;

  res.status = function status(code) {
    this.statusCode = code;
    return this;
  };

  res.send = function send(body) {
    if (body === undefined || body === null) {
      this.end();
      return this;
    }
    if (Buffer.isBuffer(body) || typeof body === 'string') {
      this.end(body);
      return this;
    }
    return this.json(body);
  };

  res.json = function json(body) {
    if (!this.getHeader('content-type')) {
      this.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    this.end(JSON.stringify(body));
    return this;
  };

  res.sendFile = async function sendFile(filePath) {
    const absolute = path.resolve(String(filePath));
    const data = await fsp.readFile(absolute);
    if (!this.getHeader('content-type')) {
      this.setHeader('Content-Type', mimeTypeFor(absolute));
    }
    this.setHeader('Content-Length', String(data.length));
    this.end(data);
    return this;
  };

  return res;
};

const createStack = () => {
  const layers = [];

  const addLayer = (layer) => {
    layers.push(layer);
  };

  const handle = async (req, res, out) => {
    enhanceResponse(res);
    const originalUrl = req.url;
    const originalBaseUrl = req.baseUrl || '';
    let index = 0;
    let activeError = null;

    const next = async (error) => {
      if (error) activeError = error;
      while (index < layers.length) {
        const layer = layers[index++];
        const { method, path: layerPath, handler, type, options } = layer;
        const pathname = new URL(req.url, 'http://localhost').pathname;

        if (activeError) {
          if (type !== 'error') continue;
          try {
            const maybe = handler(activeError, req, res, next);
            if (isPromise(maybe)) await maybe;
            return;
          } catch (err) {
            activeError = err;
            continue;
          }
        }

        if (type === 'error') continue;

        if (method && !(req.method === method || (req.method === 'HEAD' && method === 'GET'))) continue;

        const mountLike = type === 'mount' || type === 'middleware' || type === 'static';
        const match = matchPath(pathname, layerPath, { prefix: mountLike });
        if (!match) continue;

        const prevUrl = req.url;
        const prevBaseUrl = req.baseUrl || '';
        req.params = { ...(req.params || {}), ...match.params };
        req.baseUrl = prevBaseUrl + (Array.isArray(layerPath) ? '' : (layerPath && layerPath !== '/' && !String(layerPath).includes(':') ? String(layerPath).replace(/\/+$/u, '') : ''));

        if (type === 'static') {
          const served = await serveRoot(req, res, options, pathname);
          if (served) return;
          req.url = prevUrl;
          req.baseUrl = prevBaseUrl;
          continue;
        }

        if (type === 'mount' && handler?.handle) {
          const mountPath = Array.isArray(layerPath) ? '' : String(layerPath || '');
          const stripped = mountPath && mountPath !== '/' ? prevUrl.slice(mountPath.length) || '/' : prevUrl;
          req.url = stripped.startsWith('/') ? stripped : `/${stripped}`;
          req.baseUrl = prevBaseUrl + (mountPath && mountPath !== '/' ? mountPath.replace(/\/+$/u, '') : '');
          try {
            await handler.handle(req, res, (err) => {
              if (err) activeError = err;
            });
            if (!res.writableEnded) {
              req.url = prevUrl;
              req.baseUrl = prevBaseUrl;
              continue;
            }
            return;
          } catch (err) {
            activeError = err;
            req.url = prevUrl;
            req.baseUrl = prevBaseUrl;
            continue;
          }
        }

        try {
          const maybe = handler(req, res, next);
          if (isPromise(maybe)) await maybe;
          if (res.writableEnded) return;
        } catch (err) {
          activeError = err;
          req.url = prevUrl;
          req.baseUrl = prevBaseUrl;
          continue;
        }

        req.url = prevUrl;
        req.baseUrl = prevBaseUrl;
        if (res.writableEnded) return;
      }

      if (activeError) {
        if (out) {
          out(activeError);
          return;
        }
        if (!res.headersSent) {
          res.statusCode = activeError.statusCode || 500;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        }
        res.end(activeError.message || 'internal error');
        return;
      }

      if (out) {
        out();
        return;
      }
    };

    await next();
    req.url = originalUrl;
    req.baseUrl = originalBaseUrl;
  };

  return { addLayer, handle };
};

const createApp = () => {
  const stack = createStack();
  const app = {
    disable() {
      return app;
    },
    use(pathOrHandler, maybeHandler) {
      if (typeof pathOrHandler === 'function' || (pathOrHandler && typeof pathOrHandler.handle === 'function')) {
        const handler = pathOrHandler;
        if (handler && typeof handler.handle === 'function') {
          stack.addLayer({ type: 'mount', path: '/', handler });
        } else {
          stack.addLayer({ type: handler.length === 4 ? 'error' : 'middleware', path: '/', handler });
        }
        return app;
      }

      const pathPattern = pathOrHandler;
      const handler = maybeHandler;
      if (handler && typeof handler.handle === 'function') {
        stack.addLayer({ type: 'mount', path: pathPattern, handler });
        return app;
      }
      stack.addLayer({ type: handler.length === 4 ? 'error' : 'middleware', path: pathPattern, handler });
      return app;
    },
    get(pathPattern, handler) {
      stack.addLayer({ type: 'route', method: 'GET', path: pathPattern, handler });
      return app;
    },
    listen(port, callback) {
      const server = http.createServer((req, res) => {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        req.originalUrl = req.url;
        req.baseUrl = '';
        req.path = url.pathname;
        req.query = Object.fromEntries(url.searchParams.entries());
        req.params = {};
        req.body = undefined;
        req.get = (name) => req.headers[String(name || '').toLowerCase()];

        stack.handle(req, res).catch((error) => {
          if (res.headersSent) {
            if (!res.writableEnded) res.destroy(error);
            return;
          }
          res.statusCode = error?.statusCode || 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: error?.message || 'internal error', details: error?.details }));
        });
      });
      return server.listen(port, callback);
    },
  };
  return app;
};

const createRouter = () => {
  const stack = createStack();
  const router = {
    use(pathOrHandler, maybeHandler) {
      if (typeof pathOrHandler === 'function' || (pathOrHandler && typeof pathOrHandler.handle === 'function')) {
        const handler = pathOrHandler;
        if (handler && typeof handler.handle === 'function') {
          stack.addLayer({ type: 'mount', path: '/', handler });
        } else {
          stack.addLayer({ type: handler.length === 4 ? 'error' : 'middleware', path: '/', handler });
        }
        return router;
      }
      const pathPattern = pathOrHandler;
      const handler = maybeHandler;
      if (handler && typeof handler.handle === 'function') {
        stack.addLayer({ type: 'mount', path: pathPattern, handler });
        return router;
      }
      stack.addLayer({ type: handler.length === 4 ? 'error' : 'middleware', path: pathPattern, handler });
      return router;
    },
    get(pathPattern, handler) {
      stack.addLayer({ type: 'route', method: 'GET', path: pathPattern, handler });
      return router;
    },
    handle(req, res, next) {
      return stack.handle(req, res, next);
    },
  };
  return router;
};

const staticMiddleware = (root, options = {}) => {
  const extensions = Array.isArray(options.extensions) ? options.extensions : [];
  const indexEnabled = options.index !== false;
  const maxAge = options.maxAge || 0;
  const rootDir = path.resolve(String(root || '.'));

  const safeResolve = (pathname) => {
    const normalized = path.posix.normalize(decodeURIComponent(pathname)).replace(/^\/+/, '');
    const resolved = path.resolve(rootDir, normalized);
    if (!resolved.startsWith(rootDir + path.sep) && resolved !== rootDir) return null;
    return resolved;
  };

  return async (req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method)) return next();
    const url = new URL(req.url, 'http://localhost');
    let pathname = url.pathname;
    let filePath = safeResolve(pathname);

    const tryServe = async (candidate) => {
      try {
        const stat = await fsp.stat(candidate);
        if (stat.isDirectory()) return false;
        res.statusCode = 200;
        res.setHeader('Content-Type', mimeTypeFor(candidate));
        if (maxAge) res.setHeader('Cache-Control', `public, max-age=${Math.floor(Number(maxAge) || 0)}`);
        res.setHeader('Content-Length', String(stat.size));
        if (req.method === 'HEAD') {
          res.end();
          return true;
        }
        fs.createReadStream(candidate).pipe(res);
        return true;
      } catch {
        return false;
      }
    };

    if (filePath && await tryServe(filePath)) return;

    for (const ext of extensions) {
      if (pathname.endsWith(`.${ext}`)) continue;
      filePath = safeResolve(`${pathname}.${ext}`);
      if (filePath && await tryServe(filePath)) return;
    }

    if (indexEnabled && (pathname === '/' || pathname === '')) {
      filePath = safeResolve('index.html');
      if (filePath && await tryServe(filePath)) return;
    }

    return next();
  };
};

const jsonParser = ({ limit = '1mb' } = {}) => {
  const limitBytes = limitToBytes(limit);
  return async (req, _res, next) => {
    try {
      const contentType = String(req.headers['content-type'] || '').toLowerCase();
      if (!contentType.includes('application/json')) {
        req.body = undefined;
        return next();
      }
      const raw = await readBody(req, limitBytes);
      req.body = raw.trim() ? JSON.parse(raw) : {};
      return next();
    } catch (error) {
      error.statusCode = error.statusCode || 400;
      return next(error);
    }
  };
};

const urlencodedParser = ({ limit = '1mb' } = {}) => {
  const limitBytes = limitToBytes(limit);
  return async (req, _res, next) => {
    try {
      const contentType = String(req.headers['content-type'] || '').toLowerCase();
      if (!contentType.includes('application/x-www-form-urlencoded')) {
        req.body = undefined;
        return next();
      }
      const raw = await readBody(req, limitBytes);
      const params = new URLSearchParams(raw);
      req.body = Object.fromEntries(params.entries());
      return next();
    } catch (error) {
      error.statusCode = error.statusCode || 400;
      return next(error);
    }
  };
};

const express = () => createApp();
express.Router = () => createRouter();
express.static = (root, options) => staticMiddleware(root, options);
express.json = (options) => jsonParser(options);
express.urlencoded = (options) => urlencodedParser(options);

export default express;
