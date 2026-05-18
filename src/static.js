import fs from 'node:fs/promises';
import path from 'node:path';

const EXT_TO_TYPE = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.json', 'application/json; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8']
]);

export function contentTypeFor(filePath) {
  return EXT_TO_TYPE.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
}

export function resolveStaticPath(rootDir, requestPath) {
  const cleaned = String(requestPath ?? '').replace(/^\/+/, '');
  if (!cleaned || cleaned.includes('\0')) return '';

  const resolved = path.resolve(rootDir, cleaned);
  const root = path.resolve(rootDir) + path.sep;
  if (!resolved.startsWith(root)) return '';
  return resolved;
}

export async function readStaticFile(rootDir, requestPath) {
  const filePath = resolveStaticPath(rootDir, requestPath);
  if (!filePath) return null;

  try {
    const data = await fs.readFile(filePath);
    return { filePath, data, contentType: contentTypeFor(filePath) };
  } catch {
    return null;
  }
}
