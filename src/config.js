export const APP_NAME = 'AuroraTube';
export const DEFAULT_PORT = 3000;

export const INVIDIOUS_INSTANCES = Object.freeze([
  'https://inv.nadeko.net',
  'https://invidious.f5.si',
  'https://invidious.lunivers.trade',
  'https://iv.melmac.space',
  'https://yt.omada.cafe',
  'https://invidious.nerdvpn.de',
  'https://invidious.tiekoetter.com',
  'https://yewtu.be'
]);

export const CACHE_TTL_MS = 60_000;
export const REQUEST_TIMEOUT_MS = 12_000;
export const YTDLP_TIMEOUT_MS = 25_000;
export const STREAM_TIMEOUT_MS = 30_000;

function parsePort(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PORT;
}

export const config = Object.freeze({
  name: APP_NAME,
  port: parsePort(process.env.PORT),
  proxyUrl: String(process.env.PROXY_URL ?? '').trim(),
  invidiousInstances: INVIDIOUS_INSTANCES,
  cacheTtlMs: CACHE_TTL_MS,
  requestTimeoutMs: REQUEST_TIMEOUT_MS,
  ytdlpTimeoutMs: YTDLP_TIMEOUT_MS,
  streamTimeoutMs: STREAM_TIMEOUT_MS,
  ytdlpPath: 'yt-dlp',
  ffmpegPath: 'ffmpeg'
});
