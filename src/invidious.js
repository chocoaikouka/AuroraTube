import { REQUEST_TIMEOUT_MS } from './config.js';
import { firstSuccessfulJson } from './invidiousPool.js';
import { labelFormat, pickThumbnail, scoreFormat, normalizeVideoUrl } from './format.js';

function normalizeSearchItem(item) {
  if (!item) return null;
  const id = item.videoId || item.video_id || item.id || '';
  return {
    id,
    title: item.title || 'Untitled',
    description: item.description || '',
    thumbnail: pickThumbnail(item.videoThumbnails || item.thumbnails || []) || item.thumbnail || '',
    author: item.author || item.uploader || item.channelTitle || '',
    channelId: item.authorId || item.channelId || '',
    duration: item.lengthSeconds || item.length_seconds || '',
    viewCount: item.viewCount || item.views || 0,
    publishedText: item.publishedText || item.published || '',
    url: id ? normalizeVideoUrl(id) : '',
    source: 'invidious',
    hlsAvailable: Boolean(item.hlsUrl || item.hls_url),
    formats: normalizeFormats(item)
  };
}

function normalizeFormats(item) {
  const out = [];
  const hlsUrl = item.hlsUrl || item.hls_url || '';
  if (hlsUrl) {
    out.push({
      id: 'hls',
      label: 'HLS',
      directUrl: hlsUrl,
      mimeType: 'application/vnd.apple.mpegurl',
      hasAudio: true,
      hasVideo: true,
      hls: true,
      source: 'invidious',
      bandwidth: 0,
      width: 0,
      height: 0,
      fps: 0,
      ext: 'm3u8',
      audioCodec: 'unknown',
      videoCodec: 'unknown',
      container: 'm3u8',
      note: 'direct-hls'
    });
  }
  return out;
}

function normalizeChannelMeta(data) {
  return {
    id: data?.authorId || data?.id || '',
    title: data?.author || data?.title || 'Channel',
    description: data?.description || '',
    thumbnail: pickThumbnail(data?.authorThumbnails || data?.authorBanners || []),
    subscriberCount: data?.subCount || 0,
    totalViews: data?.totalViews || 0,
    joined: data?.joined || 0
  };
}

function normalizeChannelVideos(data) {
  const videos = Array.isArray(data?.videos) ? data.videos : Array.isArray(data?.latestVideos) ? data.latestVideos : [];
  return videos.map(normalizeSearchItem).filter(Boolean);
}

function normalizeVideo(data) {
  const formats = [];
  const adaptive = [...(data?.adaptiveFormats || []), ...(data?.formatStreams || [])];
  for (const format of adaptive) {
    if (!format) continue;
    const url = format.url || format.proxyUrl || format.hlsUrl || format.hls_url || '';
    const hls = String(url).includes('.m3u8') || String(format.type || '').includes('mpegURL');
    const hasVideo = Boolean(format.width || format.height || format.resolution || format.qualityLabel);
    const hasAudio = Boolean(format.audioQuality || format.audioChannels || format.bitrate || format.audioSampleRate);
    formats.push({
      id: String(format.itag || format.quality || format.index || format.id || ''),
      label: labelFormat({
        height: format.height || Number.parseInt(String(format.qualityLabel || format.resolution || ''), 10) || 0,
        fps: format.fps || 0,
        audioCodec: format.audioQuality || format.audioChannels || 'unknown',
        videoCodec: format.container || format.ext || 'unknown',
        mimeType: format.type || format.mimeType || '',
        id: format.itag || format.quality || format.id
      }),
      directUrl: url,
      mimeType: format.type || format.mimeType || '',
      hasAudio,
      hasVideo,
      hls,
      source: 'invidious',
      bandwidth: Number(format.bitrate || format.tbr || 0),
      width: Number(format.width || 0),
      height: Number(format.height || 0),
      fps: Number(format.fps || 0),
      ext: format.container || format.ext || '',
      audioCodec: format.audioQuality || 'unknown',
      videoCodec: format.container || format.ext || 'unknown',
      container: format.container || format.ext || '',
      note: hasVideo && hasAudio ? 'muxed' : hasVideo ? 'video-only' : hasAudio ? 'audio-only' : 'unknown'
    });
  }

  const hlsUrl = data?.hlsUrl || data?.hls_url || '';
  if (hlsUrl) {
    formats.unshift({
      id: 'hls',
      label: 'HLS',
      directUrl: hlsUrl,
      mimeType: 'application/vnd.apple.mpegurl',
      hasAudio: true,
      hasVideo: true,
      hls: true,
      source: 'invidious',
      bandwidth: 0,
      width: 0,
      height: 0,
      fps: 0,
      ext: 'm3u8',
      audioCodec: 'unknown',
      videoCodec: 'unknown',
      container: 'm3u8',
      note: 'direct-hls'
    });
  }

  return {
    meta: {
      id: data?.videoId || data?.id || '',
      title: data?.title || 'Untitled',
      description: data?.description || '',
      thumbnail: pickThumbnail(data?.videoThumbnails || []) || data?.thumbnail || '',
      author: data?.author || data?.uploader || '',
      channelId: data?.authorId || data?.channelId || '',
      duration: data?.lengthSeconds || data?.length_seconds || '',
      viewCount: data?.viewCount || 0,
      availability: data?.videoId ? 'available' : 'unknown',
      ageLimit: data?.ageLimit || 0,
      isLive: Boolean(data?.liveNow),
      drm: Boolean(data?.drm)
    },
    formats: formats.sort((a, b) => scoreFormat(b) - scoreFormat(a)),
    hlsAvailable: Boolean(hlsUrl),
    hlsUrl,
    directUrl: '',
    relatedVideos: (Array.isArray(data?.recommendedVideos) ? data.recommendedVideos : []).map(normalizeSearchItem).filter(Boolean)
  };
}

export async function invidiousSearch(query) {
  const path = `/search?q=${encodeURIComponent(query)}&type=video&sort_by=relevance&hl=en`;
  const { data } = await firstSuccessfulJson(path, {
    timeoutMs: REQUEST_TIMEOUT_MS,
    validate: (payload) => (Array.isArray(payload) ? payload.map(normalizeSearchItem).filter(Boolean) : [])
  });
  return data;
}

export async function invidiousTrending(type = 'default') {
  const path = `/trending?type=${encodeURIComponent(type)}&region=US&hl=en`;
  const { data } = await firstSuccessfulJson(path, {
    timeoutMs: REQUEST_TIMEOUT_MS,
    validate: (payload) => (Array.isArray(payload) ? payload.map(normalizeSearchItem).filter(Boolean) : [])
  });
  return data;
}

export async function invidiousWatch(videoId) {
  const { data } = await firstSuccessfulJson(`/videos/${encodeURIComponent(videoId)}?hl=en`, {
    timeoutMs: REQUEST_TIMEOUT_MS,
    validate: (payload) => payload && typeof payload === 'object' && (payload.videoId || payload.id)
  });
  return normalizeVideo(data);
}

export async function invidiousChannel(channelId, continuation = '') {
  const metaPath = `/channels/${encodeURIComponent(channelId)}?hl=en`;
  const listPath = `/channels/${encodeURIComponent(channelId)}/videos${continuation ? `?continuation=${encodeURIComponent(continuation)}&hl=en` : '?hl=en'}`;

  const [metaResult, videosResult] = await Promise.all([
    firstSuccessfulJson(metaPath, {
      timeoutMs: REQUEST_TIMEOUT_MS,
      validate: (payload) => payload && typeof payload === 'object' && (payload.authorId || payload.id || payload.title)
    }),
    firstSuccessfulJson(listPath, {
      timeoutMs: REQUEST_TIMEOUT_MS,
      validate: (payload) => payload && typeof payload === 'object' && Array.isArray(payload.videos)
    })
  ]);

  return {
    meta: normalizeChannelMeta(metaResult.data),
    videos: normalizeChannelVideos(videosResult.data),
    continuation: videosResult.data?.continuation || '',
    source: 'invidious'
  };
}
