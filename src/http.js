export function json(res, statusCode, payload, headers = {}) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.end(JSON.stringify(payload));
}

export function badRequest(res, message = 'Bad request') {
  return json(res, 400, { error: 'bad_request', message });
}

export function notFound(res, message = 'Not found') {
  return json(res, 404, { error: 'not_found', message });
}
