function isoNow() {
  return new Date().toISOString();
}

function sanitize(value) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }

  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = sanitize(entry);
    }
    return out;
  }

  return value;
}

function emit(level, message, fields = {}) {
  const payload = JSON.stringify({
    ts: isoNow(),
    level,
    message,
    ...sanitize(fields)
  });
  const writer = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  writer(payload);
}

export const log = Object.freeze({
  info: (message, fields = {}) => emit('info', message, fields),
  warn: (message, fields = {}) => emit('warn', message, fields),
  error: (message, fields = {}) => emit('error', message, fields)
});
