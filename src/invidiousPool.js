import { INVIDIOUS_INSTANCES, REQUEST_TIMEOUT_MS } from './config.js';
import { log } from './logger.js';

function normalizeInstance(url) {
  const raw = String(url || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  return raw.endsWith('/api/v1') ? raw : `${raw}/api/v1`;
}

function buildUrl(baseUrl, requestPath) {
  const safePath = requestPath.startsWith('/') ? requestPath : `/${requestPath}`;
  return `${normalizeInstance(baseUrl)}${safePath}`;
}

function isAllowedHttpUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function fetchJsonFromInstance(instance, requestPath, { timeoutMs = REQUEST_TIMEOUT_MS, signal } = {}) {
  const url = buildUrl(instance, requestPath);
  if (!isAllowedHttpUrl(url)) {
    throw new Error('Invalid Invidious URL');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  const onAbort = () => controller.abort(signal?.reason || new Error('aborted'));
  if (signal) signal.addEventListener('abort', onAbort, { once: true });

  const started = Date.now();
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'AuroraTube/2.0',
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    if (!text.trim()) {
      throw new Error('Empty JSON body');
    }

    return {
      data: JSON.parse(text),
      latencyMs: Date.now() - started,
      instance: normalizeInstance(instance)
    };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

export async function firstSuccessfulJson(requestPath, { validate, timeoutMs, instances = INVIDIOUS_INSTANCES } = {}) {
  const list = (Array.isArray(instances) ? instances : []).map(normalizeInstance).filter(Boolean);
  if (!list.length) {
    throw new Error('No Invidious instances configured');
  }

  const controllers = [];
  const errors = [];

  const tasks = list.map((instance) => {
    const controller = new AbortController();
    controllers.push(controller);
    return fetchJsonFromInstance(instance, requestPath, { timeoutMs, signal: controller.signal })
      .then((result) => {
        const output = validate ? validate(result.data, result.instance) : result.data;
        if (output === null || output === undefined || output === false) {
          throw new Error('Validation rejected response');
        }
        return { instance: result.instance, latencyMs: result.latencyMs, data: output };
      })
      .catch((error) => {
        if (error?.message === 'superseded' || error?.message === 'aborted' || error?.name === 'AbortError') {
          throw error;
        }
        errors.push({ instance, error: error.message });
        log.warn('Invidious instance failed', { instance, requestPath, error: error.message });
        throw error;
      });
  });

  try {
    const winner = await Promise.any(tasks);
    for (const controller of controllers) {
      try {
        controller.abort(new Error('superseded'));
      } catch {}
    }
    return winner;
  } catch {
    const detail = new AggregateError(
      errors.map((entry) => new Error(`${entry.instance}: ${entry.error}`)),
      `All Invidious instances failed for ${requestPath}`
    );
    detail.causes = errors;
    throw detail;
  }
}
