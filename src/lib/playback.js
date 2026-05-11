import { isNonEmptyString } from './strings.js';
import { collectFormats } from './media.js';

const toScore = (format) => [
  Number(format?.height || 0),
  Number(format?.width || 0),
  Number(format?.fps || 0),
  Number(format?.tbr || 0),
  Number(format?.filesize_approx || format?.filesize || 0),
];

const compareScore = (left = [], right = []) => {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const delta = (right[index] || 0) - (left[index] || 0);
    if (delta !== 0) return delta;
  }
  return 0;
};

const isMuxed = (format) => Boolean(
  format
  && ((format.vcodec && format.vcodec !== 'none' && format.acodec && format.acodec !== 'none')
    || (format.mime && format.mime.includes('video') && format.mime.includes('audio')))
);

const isVideoOnly = (format) => Boolean(
  format
  && ((format.vcodec && format.vcodec !== 'none' && (!format.acodec || format.acodec === 'none'))
    || (format.mime && format.mime.includes('video') && !format.mime.includes('audio')))
);

const isAudioOnly = (format) => Boolean(
  format
  && ((format.acodec && format.acodec !== 'none' && (!format.vcodec || format.vcodec === 'none'))
    || (format.mime && format.mime.includes('audio') && !format.mime.includes('video')))
);

const buildStreamUrl = (videoId, quality = '') => {
  const id = encodeURIComponent(String(videoId || ''));
  const qs = new URLSearchParams();
  if (isNonEmptyString(quality) && quality !== 'auto') qs.set('quality', quality);
  const query = qs.toString();
  return query ? `/api/watch/${id}/stream?${query}` : `/api/watch/${id}/stream`;
};

const buildDownloadUrl = (videoId, quality = '') => {
  const id = encodeURIComponent(String(videoId || ''));
  const qs = new URLSearchParams();
  if (isNonEmptyString(quality) && quality !== 'auto') qs.set('quality', quality);
  const query = qs.toString();
  return query ? `/api/watch/${id}/download?${query}` : `/api/watch/${id}/download`;
};

const qualityValue = (format) => {
  const label = String(format?.qualityLabel || '').trim();
  if (label) return label.toLowerCase();
  if (Number(format?.height || 0) > 0) return `${Number(format.height)}p`;
  if (Number(format?.width || 0) > 0 && Number(format?.height || 0) > 0) return `${Number(format.width)}x${Number(format.height)}`;
  return '';
};

const formatQualityLabel = (format) => {
  const label = String(format?.qualityLabel || '').trim();
  if (label) return label;
  if (Number(format?.height || 0) > 0) return `${Number(format.height)}p`;
  if (Number(format?.width || 0) > 0 && Number(format?.height || 0) > 0) return `${Number(format.width)}×${Number(format.height)}`;
  return 'unknown';
};

const matchesQuality = (format, quality) => {
  const requested = String(quality || '').trim().toLowerCase();
  if (!requested || requested === 'auto' || requested === 'best') return false;
  const candidates = [
    qualityValue(format),
    String(format?.qualityLabel || '').trim().toLowerCase(),
    String(format?.height || '').trim().toLowerCase(),
    String(format?.width && format?.height ? `${format.width}x${format.height}` : '').trim().toLowerCase(),
  ].filter(Boolean);
  return candidates.includes(requested);
};

const pickBest = (formats, predicate, quality = '') => {
  const candidates = [...formats].filter(predicate);
  if (!candidates.length) return null;
  if (isNonEmptyString(quality) && quality !== 'auto' && quality !== 'best') {
    const exact = candidates.find((format) => matchesQuality(format, quality));
    if (exact) return exact;
  }
  return candidates.sort((left, right) => compareScore(toScore(left), toScore(right)))[0] || null;
};

const buildQualityOptions = (formats) => {
  const options = [{ value: 'auto', label: '自動' }];
  const seen = new Set(['auto']);
  for (const format of [...formats].sort((left, right) => compareScore(toScore(left), toScore(right)))) {
    const value = qualityValue(format);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    options.push({
      value,
      label: formatQualityLabel(format),
      height: Number(format?.height || 0),
      width: Number(format?.width || 0),
      fps: Number(format?.fps || 0),
    });
  }
  return options;
};

export const selectPlaybackPlan = (video = {}, { videoId = '', allowHls = true, quality = '' } = {}) => {
  const formats = collectFormats(video);
  const qualityOptions = buildQualityOptions(formats.filter((format) => isMuxed(format) || isVideoOnly(format)));
  const normalizedQuality = String(quality || '').trim().toLowerCase();
  const requestedQuality = normalizedQuality && normalizedQuality !== 'best' ? normalizedQuality : 'auto';
  const hasExactQuality = requestedQuality !== 'auto' && formats.some((format) => (isMuxed(format) || isVideoOnly(format)) && matchesQuality(format, requestedQuality));
  const selectedQuality = hasExactQuality ? requestedQuality : 'auto';

  const muxed = pickBest(formats, isMuxed, selectedQuality);
  if (muxed?.url) {
    return {
      kind: 'muxed',
      sourceUrl: muxed.url,
      playUrl: buildStreamUrl(videoId, selectedQuality),
      downloadUrl: buildDownloadUrl(videoId, selectedQuality),
      proxy: true,
      warning: '',
      source: 'muxed-format',
      selectedQuality,
      qualities: qualityOptions,
    };
  }

  const videoOnly = pickBest(formats, isVideoOnly, selectedQuality);
  const audioOnly = pickBest(formats, isAudioOnly);
  if (videoOnly?.url && audioOnly?.url) {
    return {
      kind: 'dash',
      sourceUrl: videoOnly.url,
      videoUrl: videoOnly.url,
      audioUrl: audioOnly.url,
      playUrl: buildStreamUrl(videoId, selectedQuality),
      downloadUrl: buildDownloadUrl(videoId, selectedQuality),
      proxy: true,
      warning: '',
      source: 'adaptive-formats',
      selectedQuality,
      qualities: qualityOptions,
    };
  }

  if (allowHls && isNonEmptyString(video.hlsUrl)) {
    return {
      kind: 'hls',
      sourceUrl: video.hlsUrl,
      playUrl: buildStreamUrl(videoId, selectedQuality),
      downloadUrl: buildDownloadUrl(videoId, selectedQuality),
      proxy: true,
      warning: '',
      source: 'hls-url',
      selectedQuality: 'auto',
      qualities: [{ value: 'auto', label: '自動' }],
    };
  }

  if (isNonEmptyString(video.dashUrl)) {
    return {
      kind: 'dash-manifest',
      sourceUrl: video.dashUrl,
      playUrl: buildStreamUrl(videoId, selectedQuality),
      downloadUrl: buildDownloadUrl(videoId, selectedQuality),
      proxy: true,
      warning: '',
      source: 'dash-url',
      selectedQuality: 'auto',
      qualities: [{ value: 'auto', label: '自動' }],
    };
  }

  return null;
};
