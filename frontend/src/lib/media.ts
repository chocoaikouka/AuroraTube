import type { VideoFormat, VideoSummary } from '../types';

export function buildStreamHref(videoId: string, formatId = '', direct = false): string {
  const params = new URLSearchParams();
  if (formatId) params.set('format', formatId);
  if (direct) params.set('direct', '1');
  const query = params.toString();
  return `/api/stream/${encodeURIComponent(videoId)}${query ? `?${query}` : ''}`;
}

export function buildDownloadHref(videoId: string, formatId = ''): string {
  const params = new URLSearchParams();
  if (formatId) params.set('format', formatId);
  const query = params.toString();
  return `/api/download/${encodeURIComponent(videoId)}${query ? `?${query}` : ''}`;
}

export function pickDownloadFormat(formats: VideoFormat[] = [], preferredId = ''): VideoFormat | null {
  if (!Array.isArray(formats) || formats.length === 0) return null;
  const preferred = preferredId ? formats.find((format) => String(format.id) === String(preferredId)) : null;
  if (preferred && preferred.directUrl && (preferred.hasAudio || preferred.hasVideo) && !preferred.hls) return preferred;
  const muxed = formats.find((format) => format.directUrl && format.hasAudio && format.hasVideo && !format.hls);
  if (muxed) return muxed;
  const muxedAny = formats.find((format) => format.directUrl && format.hasAudio && format.hasVideo);
  if (muxedAny) return muxedAny;
  const videoOnly = formats.find((format) => format.directUrl && format.hasVideo && !format.hls);
  if (videoOnly) return videoOnly;
  const audioOnly = formats.find((format) => format.directUrl && format.hasAudio && !format.hasVideo);
  if (audioOnly) return audioOnly;
  return preferred || formats[0] || null;
}

export function sortVideosByViews(videos: VideoSummary[] = []): VideoSummary[] {
  return [...videos].sort((a, b) => Number(b?.viewCount || 0) - Number(a?.viewCount || 0));
}

export function sortVideosByDuration(videos: VideoSummary[] = []): VideoSummary[] {
  return [...videos].sort((a, b) => Number(b?.duration || 0) - Number(a?.duration || 0));
}
