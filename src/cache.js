import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const CACHE_DIR = path.join(os.tmpdir(), 'auroratube-cache');

async function ensureDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

function keyToFile(key) {
  const hash = crypto.createHash('sha1').update(String(key)).digest('hex');
  return path.join(CACHE_DIR, `${hash}.json`);
}

export async function getCachedJson(key, ttlMs) {
  try {
    const raw = await fs.readFile(keyToFile(key), 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (Date.now() - Number(parsed.createdAt || 0) > ttlMs) return null;
    return parsed.value ?? null;
  } catch {
    return null;
  }
}

export async function setCachedJson(key, value) {
  await ensureDir();
  await fs.writeFile(keyToFile(key), JSON.stringify({ createdAt: Date.now(), value }), 'utf8');
}

export async function getOrSetCachedJson(key, ttlMs, producer) {
  const cached = await getCachedJson(key, ttlMs);
  if (cached !== null) return cached;
  const value = await producer();
  await setCachedJson(key, value);
  return value;
}

export async function purgeExpired(ttlMs) {
  try {
    await ensureDir();
    const files = await fs.readdir(CACHE_DIR);
    const now = Date.now();
    await Promise.all(files.map(async (name) => {
      const file = path.join(CACHE_DIR, name);
      try {
        const raw = await fs.readFile(file, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed || now - Number(parsed.createdAt || 0) > ttlMs * 4) {
          await fs.unlink(file);
        }
      } catch {
        // ignore corrupted cache entries
      }
    }));
  } catch {
    // ignore cache purge errors
  }
}
