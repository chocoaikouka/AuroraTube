import { CACHE_TTL_MS } from './config.js';
import { getOrSetCachedJson } from './cache.js';
import { log } from './logger.js';
import { invidiousSearch, invidiousTrending, invidiousWatch } from './invidious.js';
import { searchFallback, trendingFallback, watchFallback } from './ytdlp.js';
import { normalizeVideoUrl } from './format.js';

function normalizeSearchResult(item, source = 'unknown') {
  return {
    id: item?.id || '',
    title: item?.title || 'Untitled',
    description: item?.description || '',
    thumbnail: item?.thumbnail || '',
    author: item?.author || '',
    channelId: item?.channelId || '',
    duration: item?.duration || '',
    viewCount: item?.viewCount || 0,
    publishedText: item?.publishedText || '',
    url: item?.url || (item?.id ? normalizeVideoUrl(item.id) : ''),
    source,
    hlsAvailable: Boolean(item?.hlsAvailable),
    formats: Array.isArray(item?.formats) ? item.formats : []
  };
}

function normalizeWatchResult(payload, source = 'unknown') {
  return {
    id: payload?.meta?.id || payload?.id || '',
    title: payload?.meta?.title || payload?.title || 'Untitled',
    description: payload?.meta?.description || payload?.description || '',
    thumbnail: payload?.meta?.thumbnail || payload?.thumbnail || '',
    author: payload?.meta?.author || payload?.author || '',
    channelId: payload?.meta?.channelId || payload?.channelId || '',
    duration: payload?.meta?.duration || payload?.duration || '',
    viewCount: payload?.meta?.viewCount || payload?.viewCount || 0,
    availability: payload?.meta?.availability || 'unknown',
    ageLimit: payload?.meta?.ageLimit || 0,
    isLive: Boolean(payload?.meta?.isLive),
    drm: Boolean(payload?.meta?.drm),
    source,
    formats: Array.isArray(payload?.formats) ? payload.formats : [],
    hlsAvailable: Boolean(payload?.hlsAvailable),
    hlsUrl: payload?.hlsUrl || '',
    directUrl: payload?.directUrl || '',
    relatedVideos: Array.isArray(payload?.relatedVideos) ? payload.relatedVideos : []
  };
}

export async function resolveSearch(query) {
  const safe = String(query || '').trim();
  const key = `search:${safe.toLowerCase()}`;
  return getOrSetCachedJson(key, CACHE_TTL_MS, async () => {
    const fallbackErrors = [];
    try {
      const items = await invidiousSearch(safe);
      if (items.length) {
        return { source: 'invidious', results: items.map((item) => normalizeSearchResult(item, 'invidious')), fallbackErrors };
      }
    } catch (error) {
      fallbackErrors.push({ source: 'invidious', error: error.message });
      log.warn('Invidious search failed', { query: safe, error: error.message });
    }

    try {
      const videos = await searchFallback(safe, { useProxy: false });
      return { source: videos?.source || 'yt-dlp', results: (videos?.videos || []).map((item) => normalizeSearchResult(item, 'yt-dlp')), fallbackErrors };
    } catch (error) {
      fallbackErrors.push({ source: 'yt-dlp', error: error.message });
      log.error('Search resolution failed', { query: safe, error: error.message });
      return { source: 'error', results: [], error: error.message, fallbackErrors };
    }
  });
}

export async function resolveTrending() {
  return getOrSetCachedJson('trending:default', CACHE_TTL_MS, async () => {
    const fallbackErrors = [];
    try {
      const items = await invidiousTrending('default');
      if (items.length) {
        return { source: 'invidious', results: items.map((item) => normalizeSearchResult(item, 'invidious')), fallbackErrors };
      }
    } catch (error) {
      fallbackErrors.push({ source: 'invidious', error: error.message });
      log.warn('Invidious trending failed', { error: error.message });
    }

    try {
      const videos = await trendingFallback({ useProxy: false });
      return { source: videos?.source || 'yt-dlp', results: (videos?.videos || []).map((item) => normalizeSearchResult(item, 'yt-dlp')), fallbackErrors };
    } catch (error) {
      fallbackErrors.push({ source: 'yt-dlp', error: error.message });
      return { source: 'error', results: [], error: error.message, fallbackErrors };
    }
  });
}

export async function resolveWatch(videoId) {
  const safeId = String(videoId || '').trim();
  return getOrSetCachedJson(`watch:${safeId}`, CACHE_TTL_MS, async () => {
    const fallbackErrors = [];

    if (!safeId) {
      return { source: 'error', error: 'Missing video id', fallbackErrors, formats: [], hlsAvailable: false, hlsUrl: '', directUrl: '' };
    }

    try {
      const proxied = await watchFallback(safeId, { useProxy: true });
      if (proxied) return { ...normalizeWatchResult(proxied, 'yt-dlp-proxy'), fallbackErrors, playbackSource: 'yt-dlp-proxy' };
    } catch (error) {
      fallbackErrors.push({ source: 'yt-dlp-proxy', error: error.message });
      log.warn('yt-dlp proxy watch failed', { videoId: safeId, error: error.message });
    }

    try {
      const fromInvidious = await invidiousWatch(safeId);
      return { ...normalizeWatchResult(fromInvidious, 'invidious'), fallbackErrors, playbackSource: 'invidious' };
    } catch (error) {
      fallbackErrors.push({ source: 'invidious', error: error.message });
      log.warn('Invidious watch failed', { videoId: safeId, error: error.message });
    }

    try {
      const direct = await watchFallback(safeId, { useProxy: false });
      if (direct) return { ...normalizeWatchResult(direct, 'yt-dlp-direct'), fallbackErrors, playbackSource: 'yt-dlp-direct' };
      throw new Error('yt-dlp direct returned no payload');
    } catch (error) {
      fallbackErrors.push({ source: 'yt-dlp-direct', error: error.message });
      return { source: 'error', error: error.message, fallbackErrors, results: [], formats: [], hlsAvailable: false, hlsUrl: '', directUrl: '' };
    }
  });
}
