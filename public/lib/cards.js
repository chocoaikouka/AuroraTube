import {
  compactText,
  escapeAttr,
  escapeHtml,
  formatCompactNumber,
  formatDuration,
  textBlock,
  timeAgo,
} from './format.js';
import { thumbnailUrl } from './images.js';
import { channelUrl, shortsUrl, watchUrl } from './routes.js';

const bestThumb = (item) => {
  const thumbs = Array.isArray(item?.videoThumbnails) ? item.videoThumbnails : [];
  if (!thumbs.length) return '';
  return thumbs
    .slice()
    .sort((left, right) => (Number(right.width || 0) * Number(right.height || 0)) - (Number(left.width || 0) * Number(left.height || 0)))[0]?.url || '';
};


export const isShortVideo = (item) => {
  const length = Number(item?.lengthSeconds || item?.duration || 0);
  return Number.isFinite(length) && length > 0 && length <= 60;
};

const videoHref = (item, variant = 'grid') => {
  if (!item?.videoId) return '#';
  if (variant === 'short' || (variant !== 'row' && isShortVideo(item))) return shortsUrl(item.videoId);
  return watchUrl(item.videoId);
};

const metaLine = (item) => {
  const views = item?.viewCount ? `${formatCompactNumber(item.viewCount)} 回視聴` : '';
  const published = item?.publishedText || (item?.published ? timeAgo(item.published) : '');
  return [views, published].filter(Boolean).join(' ・ ');
};

const avatarMarkup = (thumbnails = [], fallback = '◉') => {
  const thumb = Array.isArray(thumbnails) ? thumbnails[0]?.url || '' : '';
  if (!thumb) return `<span class="avatar-fallback">${escapeHtml(fallback)}</span>`;
  return `<img src="${escapeAttr(thumbnailUrl(thumb))}" alt="" loading="lazy" referrerpolicy="no-referrer" />`;
};

export const avatar = avatarMarkup;

const channelLinkMarkup = (authorId, content) => authorId ? `<a class="channel-link" href="${channelUrl(authorId)}">${content}</a>` : `<span class="channel-link muted">${content}</span>`;

export const videoCard = (item, variant = 'grid') => {
  const thumb = bestThumb(item);
  const duration = formatDuration(item?.lengthSeconds || item?.duration || 0);
  const live = item?.liveNow ? '<span class="badge live">LIVE</span>' : '';
  const url = videoHref(item, variant);
  const short = variant === 'short' || isShortVideo(item);
  const featured = variant === 'featured';
  const thumbClass = featured ? 'card-thumb featured-thumb' : short ? 'card-thumb short-thumb' : 'card-thumb';
  const meta = metaLine(item);
  const description = variant === 'row' && item?.description ? `<p class="card-description">${escapeHtml(compactText(item.description || '', 180))}</p>` : '';

  return `
    <article class="video-card ${short ? 'short-card' : ''} ${variant === 'row' ? 'video-row' : ''} ${featured ? 'video-featured' : ''}">
      <a class="${thumbClass}" href="${url}">
        ${thumb ? `<img src="${escapeAttr(thumbnailUrl(thumb))}" alt="${escapeHtml(item?.title || '')}" loading="lazy" referrerpolicy="no-referrer" />` : ''}
        <span class="card-overlay"></span>
        ${duration ? `<span class="duration">${escapeHtml(duration)}</span>` : ''}
        ${live}
      </a>
      <div class="video-meta">
        <a class="card-title${featured ? ' featured-title' : ''}" href="${url}">${escapeHtml(item?.title || '')}</a>
        <div class="card-channel-row">
          ${channelLinkMarkup(item?.authorId, escapeHtml(item?.author || ''))}
          ${item?.authorVerified ? '<span class="verified-badge">✓</span>' : ''}
        </div>
        ${meta ? `<div class="card-submeta">${escapeHtml(meta)}</div>` : ''}
        ${description}
      </div>
    </article>
  `;
};

export const channelCard = (item) => {
  const link = item?.authorId ? channelUrl(item.authorId) : '#';
  return `
    <article class="channel-card">
      ${item?.authorId ? `<a href="${link}" class="channel-card-head">` : '<div class="channel-card-head">'}
        <span class="channel-card-avatar">${avatarMarkup(item?.authorThumbnails)}</span>
        <span class="channel-card-copy">
          <strong class="channel-title">${escapeHtml(item?.author || '')}</strong>
          <span class="channel-submeta">${escapeHtml(item?.authorId || '')}</span>
        </span>
      </${item?.authorId ? 'a' : 'div'}>
      ${item?.description ? `<p class="channel-description">${escapeHtml(compactText(item.description || '', 160))}</p>` : ''}
    </article>
  `;
};

export const playlistCard = (playlist) => {
  const thumb = Array.isArray(playlist?.playlistThumbnails) ? playlist.playlistThumbnails[0]?.url || '' : playlist?.playlistThumbnail || '';
  return `
    <article class="playlist-card">
      <div class="playlist-cover">
        ${thumb ? `<img src="${escapeAttr(thumbnailUrl(thumb))}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : '<span class="playlist-icon">▶</span>'}
      </div>
      <div class="playlist-copy">
        <strong>${escapeHtml(playlist?.title || '')}</strong>
        <span>${escapeHtml(playlist?.playlistId || '')}</span>
      </div>
    </article>
  `;
};

export const commentCard = (comment) => `
  <article class="comment-card">
    <div class="comment-avatar">${avatarMarkup(comment?.authorThumbnails)}</div>
    <div class="comment-body">
      <div class="comment-head">
        <strong>${escapeHtml(comment?.author || '')}</strong>
        <span>${escapeHtml(comment?.publishedText || '')}</span>
      </div>
      <div class="comment-text">${textBlock(comment?.content || '')}</div>
    </div>
  </article>
`;
