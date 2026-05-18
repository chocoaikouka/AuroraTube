import { config } from './config.js';
import { log } from './logger.js';
import { labelFormat, pickThumbnail, scoreFormat, normalizeVideoUrl } from './format.js';
import { runProcess } from './proc.js';

function baseArgs() {
  return ['--no-warnings', '--skip-download', '--dump-single-json', '--no-playlist', '--no-call-home', '--no-check-certificates'];
}

export function buildYtDlpArgs(extraArgs = [], { useProxy = false } = {}) {
  const args = baseArgs();
  if (useProxy && config.proxyUrl) args.push('--proxy', config.proxyUrl);
  args.push(...extraArgs);
  return args;
}

async function extractInfo(url, { useProxy = false } = {}) {
  const args = buildYtDlpArgs([url], { useProxy });
  const { stdout } = await runProcess(config.ytdlpPath, args, { timeoutMs: config.ytdlpTimeoutMs });
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Unable to parse yt-dlp JSON: ${error.message}`);
  }
}

function simplifyFormat(format) {
  const hasVideo = Boolean(format.vcodec && format.vcodec !== 'none');
  const hasAudio = Boolean(format.acodec && format.acodec !== 'none');
  const url = format.url || format.manifest_url || '';
  const protocol = String(format.protocol || '').toLowerCase();
  const hls = protocol.includes('m3u8') || url.includes('.m3u8') || url.includes('manifest');
  return {
    id: String(format.format_id || format.id || ''),
    label: labelFormat({ height: format.height, fps: format.fps, audioCodec: format.acodec, videoCodec: format.vcodec, mimeType: format.mime_type, id: format.format_id }),
    directUrl: url,
    mimeType: format.mime_type || '',
    hasAudio,
    hasVideo,
    hls,
    source: 'yt-dlp',
    bandwidth: Number(format.tbr || 0),
    width: Number(format.width || 0),
    height: Number(format.height || 0),
    fps: Number(format.fps || 0),
    ext: format.ext || '',
    audioCodec: format.acodec || 'none',
    videoCodec: format.vcodec || 'none',
    container: format.ext || '',
    note: hasVideo && hasAudio ? 'muxed' : hasVideo ? 'video-only' : hasAudio ? 'audio-only' : 'unknown'
  };
}

function normalizeFormats(formats) {
  return (Array.isArray(formats) ? formats : []).filter(Boolean).map(simplifyFormat).sort((a, b) => scoreFormat(b) - scoreFormat(a));
}

function findHls(formats) {
  return (Array.isArray(formats) ? formats : []).find((format) => {
    const protocol = String(format?.protocol || '').toLowerCase();
    const url = String(format?.url || format?.manifest_url || '');
    return protocol.includes('m3u8') || url.includes('.m3u8') || url.includes('manifest');
  });
}

function simplifySearchEntry(entry) {
  if (!entry) return null;
  return {
    id: entry.id || entry.video_id || '',
    title: entry.title || 'Untitled',
    description: entry.description || '',
    thumbnail: pickThumbnail(entry.thumbnails || entry.video_thumbnails || []) || entry.thumbnail || '',
    author: entry.uploader || entry.channel || entry.uploader_id || entry.channel_id || '',
    channelId: entry.channel_id || entry.channelId || '',
    duration: entry.duration || entry.length_seconds || '',
    viewCount: entry.view_count || entry.viewCount || 0,
    publishedText: entry.upload_date || entry.published || '',
    url: entry.webpage_url || normalizeVideoUrl(entry.id),
    source: 'yt-dlp',
    hlsAvailable: Boolean(findHls(entry.formats || [])),
    formats: normalizeFormats(entry.formats || [])
  };
}

function simplifyWatch(info) {
  const formats = normalizeFormats(info.formats || []);
  const hls = findHls(info.formats || []);
  return {
    meta: {
      id: info.id || info.video_id || '',
      title: info.title || info.fulltitle || 'Untitled',
      description: info.description || '',
      thumbnail: info.thumbnail || pickThumbnail(info.thumbnails || []),
      author: info.uploader || info.channel || info.channel_title || '',
      channelId: info.channel_id || '',
      duration: info.duration || info.length_seconds || info.duration_string || '',
      viewCount: info.view_count || 0,
      availability: info.availability || 'unknown',
      ageLimit: info.age_limit || 0,
      isLive: Boolean(info.is_live),
      drm: Boolean(info.drm)
    },
    formats,
    hlsAvailable: Boolean(hls),
    hlsUrl: hls?.directUrl || '',
    directUrl: '',
    relatedVideos: (Array.isArray(info.related_videos) ? info.related_videos : []).map((item) => ({
      id: item.id || '',
      title: item.title || 'Untitled',
      thumbnail: item.thumbnail || pickThumbnail(item.thumbnails || []),
      url: item.webpage_url || normalizeVideoUrl(item.id)
    }))
  };
}

export async function search(query, { useProxy = false } = {}) {
  const info = await extractInfo(`ytsearch20:${String(query || '').trim()}`, { useProxy });
  return (Array.isArray(info.entries) ? info.entries : []).map(simplifySearchEntry).filter(Boolean);
}

export async function watch(videoId, { useProxy = false } = {}) {
  const info = await extractInfo(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, { useProxy });
  return simplifyWatch(info);
}

export async function trending({ useProxy = false } = {}) {
  const info = await extractInfo('https://www.youtube.com/feed/trending', { useProxy });
  return (Array.isArray(info.entries) ? info.entries : []).map(simplifySearchEntry).filter(Boolean);
}

export async function searchFallback(query, { useProxy = false } = {}) {
  try {
    const videos = await search(query, { useProxy });
    return { source: 'yt-dlp', videos };
  } catch (error) {
    log.warn('yt-dlp search failed', { query, error: error.message });
    return null;
  }
}

export async function watchFallback(videoId, { useProxy = false } = {}) {
  try {
    return await watch(videoId, { useProxy });
  } catch (error) {
    log.warn('yt-dlp watch failed', { videoId, error: error.message });
    return null;
  }
}

export async function trendingFallback({ useProxy = false } = {}) {
  try {
    const videos = await trending({ useProxy });
    return { source: 'yt-dlp', videos };
  } catch (error) {
    log.warn('yt-dlp trending failed', { error: error.message });
    return null;
  }
}
