import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

import { config, STREAM_TIMEOUT_MS } from './config.js';
import { log } from './logger.js';
import { json } from './http.js';

function scoreCandidate(format) {
  const height = Number(format?.height || 0);
  const bandwidth = Number(format?.bandwidth || 0);
  return height * 2 + bandwidth / 1000 + (format?.hasVideo ? 20 : 0) + (format?.hasAudio ? 10 : 0) + (format?.hls ? 5 : 0);
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(String(value));
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function sanitizeFilenameSegment(value) {
  const cleaned = String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/]+/g, '-')
    .replace(/[:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .trim();
  return cleaned.slice(0, 120) || 'AuroraTube';
}

export function buildAttachmentFilename(title, format) {
  const safeTitle = sanitizeFilenameSegment(title);
  const ext = sanitizeFilenameSegment(format?.ext || '').replace(/[^a-z0-9]+/gi, '').toLowerCase();
  const preferredExt = ext || 'mp4';
  return `${safeTitle}.${preferredExt}`;
}

export function contentDispositionForFilename(filename) {
  const fallback = filename.replace(/[^\x20-\x7e]+/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export function pickPlaybackCandidate(formats = [], formatId = '') {
  if (!Array.isArray(formats) || formats.length === 0) return null;
  const exact = formatId ? formats.find((format) => String(format.id) === String(formatId)) : null;
  if (exact) return exact;
  const hls = formats.find((format) => format.hls && format.directUrl);
  if (hls) return hls;
  const muxed = formats.find((format) => format.hasAudio && format.hasVideo && format.directUrl);
  if (muxed) return muxed;
  const videoOnly = formats.filter((format) => format.hasVideo && format.directUrl).sort((a, b) => scoreCandidate(b) - scoreCandidate(a))[0];
  if (videoOnly) return videoOnly;
  const audioOnly = formats.filter((format) => format.hasAudio && !format.hasVideo && format.directUrl).sort((a, b) => scoreCandidate(b) - scoreCandidate(a))[0];
  if (audioOnly) return audioOnly;
  return formats[0];
}

function pickComplementaryTracks(formats, candidate) {
  const videoTrack = candidate?.hasVideo ? candidate : formats.filter((format) => format.hasVideo && format.directUrl).sort((a, b) => scoreCandidate(b) - scoreCandidate(a))[0];
  const audioTrack = candidate?.hasAudio ? candidate : formats.filter((format) => format.hasAudio && !format.hasVideo && format.directUrl).sort((a, b) => scoreCandidate(b) - scoreCandidate(a))[0];
  return { videoTrack, audioTrack };
}

function mp4Safe(codec) {
  const value = String(codec || '').toLowerCase();
  return value.includes('avc1') || value.includes('h264') || value.includes('aac') || value.includes('mp4a');
}

function shouldTranscode(videoTrack, audioTrack) {
  const videoCodec = videoTrack?.videoCodec || '';
  const audioCodec = audioTrack?.audioCodec || '';
  return !(mp4Safe(videoCodec) && mp4Safe(audioCodec));
}

function spawnFfmpegMux({ videoUrl, audioUrl, transcode = false }) {
  const args = [
    '-hide_banner',
    '-loglevel', 'warning',
    '-nostdin',
    '-i', videoUrl,
    '-i', audioUrl,
    '-map', '0:v:0',
    '-map', '1:a:0',
    ...(transcode
      ? ['-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '128k']
      : ['-c', 'copy']),
    '-f', 'mp4',
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
    'pipe:1'
  ];

  const child = spawn(config.ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString('utf8');
  });
  child.on('close', (code) => {
    if (code !== 0) {
      log.error('ffmpeg exited non-zero', { code, stderr: stderr.slice(-2000) });
    }
  });
  return child;
}

async function pipeUpstream(url, req, res) {
  if (!isHttpUrl(url)) {
    throw new Error('Invalid upstream URL');
  }

  const headers = {};
  if (req.headers.range) headers.range = req.headers.range;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('stream timeout')), STREAM_TIMEOUT_MS);
  const abortUpstream = () => {
    try {
      controller.abort(new Error('client closed'));
    } catch {}
  };
  req.once('close', abortUpstream);

  try {
    const response = await fetch(url, {
      headers,
      redirect: 'follow',
      signal: controller.signal
    });

    if (!response.ok && response.status !== 206) {
      throw new Error(`Upstream returned HTTP ${response.status}`);
    }

    for (const header of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control', 'etag', 'last-modified']) {
      const value = response.headers.get(header);
      if (value) res.setHeader(header, value);
    }

    res.statusCode = response.status;
    if (!res.getHeader('content-type')) res.setHeader('Content-Type', 'video/mp4');

    if (!response.body) {
      res.end();
      return;
    }

    await pipeline(Readable.fromWeb(response.body), res, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
    req.off('close', abortUpstream);
  }
}

export function candidateWarnings(candidate) {
  if (!candidate || candidate.hls) return [];
  return [
    'This playback is using the self-hosted proxy.',
    'Proxy playback can increase bandwidth, latency, and legal exposure.'
  ];
}

async function handleMediaRequest({ req, res, video, formats, formatId, direct = false, download = false }) {
  const candidate = pickPlaybackCandidate(formats, formatId);
  if (!candidate) {
    return json(res, 404, { error: 'stream_unavailable', message: 'No playable format was found.' });
  }

  if (video?.drm || candidate?.drm) {
    return json(res, 403, { error: 'drm_protected', message: 'This content is DRM-protected or otherwise unavailable for playback.' });
  }

  const downloadName = buildAttachmentFilename(video?.title || candidate?.label || video?.id || 'AuroraTube', candidate);
  if (download) {
    res.setHeader('Content-Disposition', contentDispositionForFilename(downloadName));
    res.setHeader('X-Download-Mode', candidate.hls ? 'hls-proxy' : 'proxy');
  }

  if (!download && direct && candidate.hls && candidate.directUrl) {
    res.statusCode = 302;
    res.setHeader('Location', candidate.directUrl);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Playback-Mode', 'direct-hls');
    res.end();
    return;
  }

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Playback-Mode', candidate.hls ? 'direct-hls' : 'proxy');
  if (!candidate.hls) {
    res.setHeader('X-Proxy-Warning', 'Non-HLS proxy playback can increase latency, bandwidth usage, and legal exposure.');
  }

  const { videoTrack, audioTrack } = pickComplementaryTracks(formats, candidate);

  try {
    if (candidate.hasAudio && candidate.hasVideo && candidate.directUrl) {
      await pipeUpstream(candidate.directUrl, req, res);
      return;
    }

    if (videoTrack?.directUrl && audioTrack?.directUrl) {
      const transcode = shouldTranscode(videoTrack, audioTrack);
      const ffmpeg = spawnFfmpegMux({ videoUrl: videoTrack.directUrl, audioUrl: audioTrack.directUrl, transcode });
      const stop = () => {
        try {
          ffmpeg.kill('SIGKILL');
        } catch {}
      };
      req.once('close', stop);
      ffmpeg.once('error', (error) => {
        log.error('ffmpeg spawn failed', { error: error.message });
        if (!res.headersSent) {
          json(res, 500, { error: 'stream_error', message: 'Unable to start ffmpeg muxing.' });
        } else {
          res.destroy(error);
        }
      });
      res.statusCode = 200;
      res.setHeader('Content-Type', 'video/mp4');
      await pipeline(ffmpeg.stdout, res);
      req.off('close', stop);
      return;
    }

    const fallbackUrl = candidate.directUrl || videoTrack?.directUrl || audioTrack?.directUrl;
    if (!fallbackUrl) {
      return json(res, 404, { error: 'stream_unavailable', message: 'Unable to resolve a direct stream URL.' });
    }

    await pipeUpstream(fallbackUrl, req, res);
  } catch (error) {
    log.error('stream request failed', { videoId: video?.id, formatId, error: error.message });
    if (!res.headersSent) {
      json(res, 502, { error: 'stream_error', message: 'Unable to start streaming for the selected format.' });
    } else {
      res.destroy(error);
    }
  }
}

export async function handleStreamRequest(args) {
  return handleMediaRequest({ ...args, download: false });
}

export async function handleDownloadRequest(args) {
  return handleMediaRequest({ ...args, download: true });
}
