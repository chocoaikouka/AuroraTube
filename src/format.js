export function normalizeVideoUrl(videoId) {
  const safe = String(videoId || '').trim();
  return safe ? `https://www.youtube.com/watch?v=${encodeURIComponent(safe)}` : '';
}

export function pickThumbnail(thumbnails = []) {
  const list = Array.isArray(thumbnails) ? thumbnails : [];
  if (!list.length) return '';
  return [...list].sort((a, b) => Number((a?.width || 0)) - Number((b?.width || 0)))[list.length - 1]?.url || '';
}

export function labelFormat({ height = 0, fps = 0, audioCodec = '', videoCodec = '', mimeType = '', id = '' }) {
  const parts = [];
  const heightValue = Number(height || 0);
  if (heightValue > 0) parts.push(`${heightValue}p`);
  const fpsValue = Number(fps || 0);
  if (fpsValue > 0) parts.push(`${fpsValue}fps`);
  if (!heightValue && String(id || '').toLowerCase().includes('audio')) parts.push('audio');
  if (audioCodec && audioCodec !== 'none' && parts.length === 0) parts.push(audioCodec);
  if (videoCodec && videoCodec !== 'none' && heightValue === 0) parts.push(videoCodec);
  if (mimeType && !parts.length) parts.push(mimeType.split(';')[0]);
  return parts.length ? parts.join(' ') : String(id || 'format');
}

export function scoreFormat(format) {
  const hasVideo = Boolean(format?.hasVideo);
  const hasAudio = Boolean(format?.hasAudio);
  const height = Number(format?.height || 0);
  const bandwidth = Number(format?.bandwidth || 0);
  const fps = Number(format?.fps || 0);
  return (hasVideo ? 1_000_000 : 0) + (hasAudio ? 500_000 : 0) + (format?.hls ? 250_000 : 0) + height * 1_000 + fps * 10 + Math.round(bandwidth / 1000);
}
