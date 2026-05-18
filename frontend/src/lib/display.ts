import type { VideoMetaLike, VideoFormat } from '../types';

export function formatOptionLabel(format: VideoFormat): string {
  const bits = [format.label || format.id || 'format'];
  if (format.hls) bits.push('HLS');
  if (format.height) bits.push(`${format.height}p`);
  return bits.join(' · ');
}

export function formatMeta(video: VideoMetaLike): string[] {
  const items: string[] = [];
  if (video.author) items.push(String(video.author));
  const viewCount = Number(video.viewCount || 0);
  if (Number.isFinite(viewCount) && viewCount > 0) {
    items.push(new Intl.NumberFormat('ja-JP', { notation: 'compact', maximumFractionDigits: 1 }).format(viewCount) + ' 回視聴');
  }
  if (video.duration !== undefined && video.duration !== null && String(video.duration).trim()) {
    items.push(String(video.duration));
  }
  return items;
}

export function truncateText(value: string, maxLength = 220): string {
  const text = String(value ?? '');
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
