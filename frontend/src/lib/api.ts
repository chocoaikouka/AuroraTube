import type { ApiErrorPayload } from '../types';

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    headers: { Accept: 'application/json' },
    signal
  });

  const payload = await response.json().catch(() => ({} as ApiErrorPayload));
  if (!response.ok) {
    throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
  }

  return payload as T;
}
