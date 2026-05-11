import { config } from '../config.js';
import { settings } from '../settings.js';
import { badRequest, notFound, unavailable } from '../lib/httpError.js';
import { normalizeCaptionTracks, normalizeThumbnails, normalizeVideoItem, pickThumbnail } from '../lib/media.js';
import { selectPlaybackPlan } from '../lib/playback.js';
import { isNonEmptyString, isPlainObject } from '../lib/strings.js';
import { extractYouTubeVideoId } from '../lib/youtube.js';
import { fetchFromAny } from '../providers/invidious.js';
import { fetchYtDlpJson } from '../providers/ytdlp.js';
import { streamPlayback } from '../lib/proxyPlayback.js';

const normalizeComment = (comment = {}) => ({
  commentId: String(comment.commentId || ''),
  author: String(comment.author || ''),
  authorId: String(comment.authorId || ''),
  authorUrl: String(comment.authorUrl || ''),
  authorIsChannelOwner: Boolean(comment.authorIsChannelOwner),
  published: Number(comment.published || 0),
  publishedText: String(comment.publishedText || ''),
  likeCount: Number(comment.likeCount || 0),
  content: String(comment.content || ''),
  contentHtml: String(comment.contentHtml || ''),
  isEdited: Boolean(comment.isEdited),
  isPinned: Boolean(comment.isPinned),
  isSponsor: Boolean(comment.isSponsor),
  sponsorIconUrl: String(comment.sponsorIconUrl || ''),
  authorThumbnails: Array.isArray(comment.authorThumbnails) ? comment.authorThumbnails : [],
  replies: comment.replies && isPlainObject(comment.replies)
    ? {
        replyCount: Number(comment.replies.replyCount || 0),
        continuation: String(comment.replies.continuation || ''),
      }
    : null,
  creatorHeart: comment.creatorHeart && isPlainObject(comment.creatorHeart)
    ? {
        creatorThumbnail: String(comment.creatorHeart.creatorThumbnail || ''),
        creatorName: String(comment.creatorHeart.creatorName || ''),
      }
    : null,
});

const normalizeYtDlpVideo = (raw = {}) => {
  const base = normalizeVideoItem({
    ...raw,
    title: String(raw.title || ''),
    author: String(raw.uploader || raw.channel || raw.author || ''),
    authorId: String(raw.channel_id || raw.channelId || raw.authorId || ''),
    authorUrl: String(raw.channel_url || raw.uploader_url || raw.authorUrl || ''),
    authorVerified: Boolean(raw.channel_is_verified || raw.uploader_verified || raw.authorVerified),
    description: String(raw.description || ''),
    descriptionHtml: String(raw.description_html || raw.descriptionHtml || ''),
    videoThumbnails: normalizeThumbnails(raw.thumbnails || raw.videoThumbnails || []),
    lengthSeconds: Number(raw.duration || raw.lengthSeconds || 0),
    viewCount: Number(raw.view_count || raw.viewCount || 0),
    published: Number(raw.timestamp || raw.release_timestamp || raw.published || 0),
    publishedText: String(raw.upload_date || raw.publishedText || ''),
    liveNow: Boolean(raw.is_live || raw.liveNow),
    isUpcoming: Boolean(raw.is_upcoming || raw.isUpcoming),
    isListed: raw.isListed === undefined ? true : Boolean(raw.isListed),
    isFamilyFriendly: raw.age_limit === 0 ? true : Boolean(raw.is_family_friendly ?? raw.isFamilyFriendly ?? true),
    genre: String(raw.category || raw.genre || (Array.isArray(raw.categories) ? raw.categories[0] : '')),
    keywords: Array.isArray(raw.tags) ? raw.tags : Array.isArray(raw.keywords) ? raw.keywords : [],
    chapters: Array.isArray(raw.chapters) ? raw.chapters : [],
    captions: normalizeCaptionTracks(raw.subtitles || raw.automatic_captions || {}),
  });

  return {
    ...base,
    formats: Array.isArray(raw.formats) ? raw.formats : [],
    formatStreams: Array.isArray(raw.formatStreams) ? raw.formatStreams : [],
    adaptiveFormats: Array.isArray(raw.adaptiveFormats) ? raw.adaptiveFormats : [],
    hlsUrl: String(raw.hlsUrl || raw.hls_url || ''),
    dashUrl: String(raw.dashUrl || raw.dash_url || ''),
    thumbnail: pickThumbnail(raw.thumbnails || raw.videoThumbnails || [])?.url || base.thumbnail || '',
    authorThumbnails: Array.isArray(raw.authorThumbnails) ? raw.authorThumbnails : [],
    relatedVideos: Array.isArray(raw.related_videos) ? raw.related_videos.map((item) => normalizeVideoItem(item)) : [],
  };
};

const getYtDlpVideo = async (videoId, { proxy = config.proxy_url } = {}) => {
  const { data, command } = await fetchYtDlpJson(videoId, { proxy });
  const video = normalizeYtDlpVideo(data);
  return {
    provider: {
      kind: 'ytdlp',
      name: 'yt-dlp',
      mode: isNonEmptyString(proxy) ? 'proxy' : 'direct',
      label: isNonEmptyString(proxy) ? 'ytDlp(proxy)' : 'ytDlp(direct)',
      proxy: isNonEmptyString(proxy) ? proxy : '',
      command,
    },
    video,
    related: video.relatedVideos,
  };
};

const getInvidiousVideo = async (videoId) => {
  const { instance, data } = await fetchFromAny(`/api/v1/videos/${encodeURIComponent(videoId)}`, { region: settings.region, hl: settings.hl });
  return {
    provider: { kind: 'invidious', name: 'invidious', instance, label: 'Invidious' },
    video: data,
    related: Array.isArray(data?.recommendedVideos) ? data.recommendedVideos : [],
  };
};

const selectPlaybackForContext = (context, videoId, quality = '') => {
  if (!context?.video) return null;
  return selectPlaybackPlan(context.video, {
    videoId,
    allowHls: true,
    quality,
  });
};

const resolveVideoContext = async (videoId, { quality = '' } = {}) => {
  const errors = [];

  if (isNonEmptyString(config.proxy_url)) {
    try {
      const context = await getYtDlpVideo(videoId, { proxy: config.proxy_url });
      const playback = selectPlaybackForContext(context, videoId, quality);
      if (playback) {
        return {
          provider: context.provider,
          video: context.video,
          playbackVideo: context.video,
          playback,
          related: context.related,
        };
      }
      errors.push('yt-dlp(proxy): playback source not found');
    } catch (error) {
      errors.push(`yt-dlp(proxy): ${error?.message || String(error)}`);
    }
  }

  try {
    const context = await getInvidiousVideo(videoId);
    const playback = selectPlaybackForContext(context, videoId, quality);
    if (playback) {
      return {
        provider: context.provider,
        video: context.video,
        playbackVideo: context.video,
        playback,
        related: context.related,
      };
    }
    errors.push('invidious: playback source not found');
  } catch (error) {
    errors.push(`invidious: ${error?.message || String(error)}`);
  }

  try {
    const context = await getYtDlpVideo(videoId, { proxy: '' });
    const playback = selectPlaybackForContext(context, videoId, quality);
    if (playback) {
      return {
        provider: context.provider,
        video: context.video,
        playbackVideo: context.video,
        playback,
        related: context.related,
      };
    }
    errors.push('yt-dlp(direct): playback source not found');
  } catch (error) {
    errors.push(`yt-dlp(direct): ${error?.message || String(error)}`);
  }

  throw unavailable('video retrieval failed', errors);
};

const fetchCommentsPayload = async (videoId, continuation = '') => {
  const { data } = await fetchFromAny(`/api/v1/comments/${encodeURIComponent(videoId)}`, {
    continuation,
    source: 'youtube',
    sort_by: 'top',
    hl: settings.hl,
  });

  return {
    comments: Array.isArray(data?.comments) ? data.comments.map(normalizeComment) : [],
    commentCount: Number(data?.commentCount || 0),
    continuation: String(data?.continuation || ''),
  };
};

const buildPlayerPayload = ({ video, provider, playback, comments, related }) => {
  const thumbnails = Array.isArray(video?.videoThumbnails) && video.videoThumbnails.length ? video.videoThumbnails : normalizeThumbnails(video?.thumbnails || []);
  const thumbnail = pickThumbnail(thumbnails);
  const captions = Array.isArray(video?.captions) ? video.captions : normalizeCaptionTracks(video?.subtitles || video?.automatic_captions || {});
  const resolvedRelated = Array.isArray(related) && related.length ? related : Array.isArray(video?.relatedVideos) ? video.relatedVideos : [];
  const streamUrl = playback?.playUrl || `/api/watch/${encodeURIComponent(String(video.videoId || video.id || ''))}/stream`;
  const downloadUrl = playback?.downloadUrl || `/api/watch/${encodeURIComponent(String(video.videoId || video.id || ''))}/download`;
  const finalUrl = playback?.sourceUrl || '';

  return {
    video: {
      ...normalizeVideoItem(video),
      videoId: String(video.videoId || video.id || ''),
      thumbnail: thumbnail?.url || String(video.thumbnail || ''),
      authorThumbnails: Array.isArray(video.authorThumbnails) ? video.authorThumbnails : [],
      captions,
      chapters: Array.isArray(video.chapters) ? video.chapters : [],
      commentsCount: Number(comments?.commentCount || 0),
      sourceLabel: provider.label || provider.name || '',
      playback: {
        kind: playback?.kind || 'unknown',
        streamUrl,
        downloadUrl,
        finalUrl,
        proxy: Boolean(playback?.proxy),
        warning: String(playback?.warning || ''),
        source: String(playback?.source || ''),
        selectedQuality: String(playback?.selectedQuality || 'auto'),
        qualities: Array.isArray(playback?.qualities) ? playback.qualities : [],
      },
    },
    provider,
    playback,
    comments: Array.isArray(comments?.comments) ? comments.comments : [],
    commentsContinuation: String(comments?.continuation || ''),
    related: Array.isArray(resolvedRelated) ? resolvedRelated.map((item) => normalizeVideoItem(item)) : [],
  };
};

const resolveSafeVideoId = (videoId) => extractYouTubeVideoId(videoId) || String(videoId || '').trim();

const fetchInitialComments = async (videoId) => {
  try {
    return await fetchCommentsPayload(videoId);
  } catch {
    return {
      comments: [],
      commentCount: 0,
      continuation: '',
    };
  }
};

export const fetchVideoPage = async (videoId, { quality = '' } = {}) => {
  const safeVideoId = extractYouTubeVideoId(videoId) || String(videoId || '').trim();
  if (!safeVideoId) throw badRequest('video id required');

  const context = await resolveVideoContext(safeVideoId, { quality });
  if (!isPlainObject(context.video)) throw unavailable('video response was not an object');

  const comments = await fetchInitialComments(safeVideoId);

  return buildPlayerPayload({
    video: context.video,
    provider: context.provider,
    playback: context.playback,
    comments,
    related: context.related,
  });
};

export const fetchVideoComments = async (videoId, continuation = '') => {
  const safeVideoId = extractYouTubeVideoId(videoId) || String(videoId || '').trim();
  if (!isNonEmptyString(safeVideoId)) throw badRequest('video id required');
  return fetchCommentsPayload(safeVideoId, continuation);
};

export const streamVideo = async (req, res, videoId, { quality = '' } = {}) => {
  const safeVideoId = resolveSafeVideoId(videoId);
  if (!safeVideoId) throw badRequest('video id required');
  const context = await resolveVideoContext(safeVideoId, { quality });
  const source = context.playback || selectPlaybackPlan(context.playbackVideo || context.video, {
    videoId: safeVideoId,
    allowHls: true,
    quality,
  });

  if (!source) throw notFound('playback source not found');
  await streamPlayback(req, res, source, { title: context.video?.title || safeVideoId, download: false });
};

export const downloadVideo = async (req, res, videoId, { quality = '' } = {}) => {
  const safeVideoId = resolveSafeVideoId(videoId);
  if (!safeVideoId) throw badRequest('video id required');
  const context = await resolveVideoContext(safeVideoId, { quality });
  const source = context.playback || selectPlaybackPlan(context.playbackVideo || context.video, {
    videoId: safeVideoId,
    allowHls: true,
    quality,
  });

  if (!source) throw notFound('playback source not found');
  await streamPlayback(req, res, source, { title: context.video?.title || safeVideoId, download: true });
};
