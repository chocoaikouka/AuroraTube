export function json(res, statusCode, payload, headers = {}) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
  res.end(JSON.stringify(payload));
}

export function badRequest(res, message = 'Bad request') {
  return json(res, 400, { error: 'bad_request', message });
}

export function notFound(res, message = 'Not found') {
  return json(res, 404, { error: 'not_found', message });
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function formatDuration(seconds) {
  const total = Number(seconds || 0);
  if (!Number.isFinite(total) || total < 0) return '';
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60).toString().padStart(2, '0');
  const secs = Math.floor(total % 60).toString().padStart(2, '0');
  return hrs > 0 ? `${hrs}:${mins}:${secs}` : `${Number(mins)}:${secs}`;
}

export function compactNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}
