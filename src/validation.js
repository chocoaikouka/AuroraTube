const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;

export function sanitizeVideoId(input) {
  const value = String(input ?? '').trim();
  return VIDEO_ID_RE.test(value) ? value : '';
}

export function sanitizeChannelId(input) {
  const value = String(input ?? '').trim();
  if (!value) return '';
  if (CHANNEL_ID_RE.test(value)) return value;
  return '';
}
