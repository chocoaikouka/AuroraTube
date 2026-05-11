import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { config } from '../config.js';
import { settings } from '../settings.js';
import { badRequest, unavailable } from './httpError.js';
import { mergeStreamsToResponse } from './ffmpegMerge.js';
import { assertSafeHttpUrl } from './urlSafety.js';
import { isNonEmptyString } from './strings.js';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

const setHeaderIfPresent = (res, name, value) => {
  if (value) res.setHeader(name, value);
};

const copyRemoteHeaders = (res, response) => {
  for (const [name, value] of response.headers.entries()) {
    const lower = name.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower)) continue;
    if (lower === 'content-length') {
      setHeaderIfPresent(res, 'Content-Length', value);
      continue;
    }
    if (lower === 'content-type' || lower === 'accept-ranges' || lower === 'content-range' || lower === 'etag' || lower === 'last-modified' || lower === 'cache-control') {
      res.setHeader(name, value);
    }
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
};

const streamRemoteRange = async (res, sourceUrl, { req, timeoutMs = settings.requestTimeoutMs, title = 'video', download = false } = {}) => {
  const url = await assertSafeHttpUrl(sourceUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = new Headers();
    headers.set('accept', '*/*');
    if (isNonEmptyString(req?.headers?.range)) {
      headers.set('range', req.headers.range);
    }

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers,
    });

    if (!response.ok && response.status !== 206) {
      throw unavailable('stream fetch failed', `HTTP ${response.status}`);
    }

    res.status(response.status === 206 ? 206 : 200);
    copyRemoteHeaders(res, response);
    if (download) {
      const safe = String(title || 'video').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'video';
      const fileName = `${safe}.mp4`;
      const encoded = encodeURIComponent(fileName).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
      const ascii = fileName.replace(/[^\x20-\x7E]/g, '_');
      res.setHeader('Content-Disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`);
    }

    if (!response.body) {
      res.end();
      return;
    }

    await pipeline(Readable.fromWeb(response.body), res);
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw unavailable('stream fetch timed out');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

const streamHlsThroughFfmpeg = async (res, sourceUrl, { title, download = false, timeoutMs = settings.requestTimeoutMs } = {}) => {
  await mergeStreamsToResponse({
    res,
    inputs: [sourceUrl],
    outputOptions: ['-map', '0:v:0', '-map', '0:a:0?', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-movflags', 'frag_keyframe+empty_moov+default_base_moof'],
    proxyUrl: config.proxy_url,
    timeoutMs,
    download,
    title,
  });
};

const streamDashThroughFfmpeg = async (res, videoUrl, audioUrl, { title, download = false, timeoutMs = settings.requestTimeoutMs } = {}) => {
  await mergeStreamsToResponse({
    res,
    inputs: [videoUrl, audioUrl],
    outputOptions: ['-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-movflags', 'frag_keyframe+empty_moov+default_base_moof'],
    proxyUrl: config.proxy_url,
    timeoutMs,
    download,
    title,
  });
};

export const streamPlayback = async (req, res, playback = {}, { title = 'video', download = false } = {}) => {
  if (!playback || !isNonEmptyString(playback.playUrl || playback.sourceUrl || playback.videoUrl)) {
    throw badRequest('playback source missing');
  }

  const kind = String(playback.kind || 'muxed');
  const sourceUrl = String(playback.sourceUrl || playback.playUrl || '');

  if (kind === 'dash' && isNonEmptyString(playback.videoUrl) && isNonEmptyString(playback.audioUrl)) {
    return streamDashThroughFfmpeg(res, playback.videoUrl, playback.audioUrl, { title, download });
  }

  if (kind === 'hls' || kind === 'dash-manifest') {
    return streamHlsThroughFfmpeg(res, sourceUrl, { title, download });
  }

  return streamRemoteRange(res, sourceUrl, { req, title, download });
};
