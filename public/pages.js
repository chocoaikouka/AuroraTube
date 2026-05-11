import { escapeAttr, escapeHtml, formatCompactNumber, formatDuration, formatNumber, textBlock } from './lib/format.js';
import { avatar, channelCard, commentCard, isShortVideo, playlistCard, videoCard } from './lib/cards.js';
import { thumbnailUrl } from './lib/images.js';
import { appShell } from './lib/shell.js';
import { channelUrl, currentUrl, searchUrl } from './lib/routes.js';
import { playerMarkup } from './player.js';

const splitVideos = (items = []) => {
  const shorts = [];
  const videos = [];
  for (const item of items) {
    if (item?.type && item.type !== 'video' && !item.videoId) continue;
    if (isShortVideo(item)) shorts.push(item);
    else videos.push(item);
  }
  return { shorts, videos };
};

const section = (title, body, action = '') => `
  <section class="section-block">
    <div class="section-head">
      <h2>${escapeHtml(title)}</h2>
      ${action}
    </div>
    ${body}
  </section>
`;

const chip = (label, href, active = false) => `<a class="topic-chip${active ? ' active' : ''}" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;

const filterRow = (query, filters = {}) => {
  const sortOptions = [
    ['関連度', 'relevance'],
    ['アップロード日', 'upload_date'],
    ['視聴回数', 'view_count'],
    ['評価順', 'rating'],
  ];
  const typeOptions = [
    ['すべて', 'all'],
    ['動画', 'video'],
    ['短尺', 'short'],
    ['チャンネル', 'channel'],
    ['再生リスト', 'playlist'],
  ];

  const makeUrl = (next) => searchUrl(query, {
    ...filters,
    ...next,
  });

  return `
    <div class="chip-row chip-row--filters">
      <div class="chip-group">
        ${sortOptions.map(([label, value]) => chip(label, makeUrl({ sort: value }), String(filters.sort || 'relevance') === value)).join('')}
      </div>
      <div class="chip-group">
        ${typeOptions.map(([label, value]) => chip(label, makeUrl({ type: value }), String(filters.type || 'all') === value)).join('')}
      </div>
    </div>
  `;
};

const heroPanel = (item) => {
  if (!item) return '';
  return `
    <div class="hero-featured-card">
      ${videoCard(item, 'featured')}
    </div>
  `;
};

const heroHeader = ({ eyebrow, title, description, meta = '' }) => `
  <section class="page-hero">
    <div class="page-hero-copy">
      <p class="eyebrow">${escapeHtml(eyebrow)}</p>
      <h1>${escapeHtml(title)}</h1>
      ${description ? `<p class="page-hero-description">${escapeHtml(description)}</p>` : ''}
      <div class="hero-meta-row">${meta}</div>
    </div>
  </section>
`;

const renderGrid = (items = [], variant = 'grid') => `<div class="${variant === 'short' ? 'short-grid' : variant === 'row' ? 'video-list' : 'video-grid'}">${items.map((item) => videoCard(item, variant)).join('')}</div>`;

const renderChannels = (items = []) => items.length ? `<div class="channel-grid">${items.map((item) => channelCard(item)).join('')}</div>` : '<div class="empty-state">チャンネルが見つかりません</div>';

const renderPlaylists = (items = []) => items.length ? `<div class="playlist-grid">${items.map((item) => playlistCard(item)).join('')}</div>` : '';

const renderLoadMore = ({ continuation, id, sortBy, label, type = 'channel' }) => continuation ? `<button class="ghost-btn load-more" type="button" data-load-${type}="${escapeAttr(continuation)}" data-${type}-id="${escapeAttr(id)}" data-sort-by="${escapeAttr(sortBy)}">${escapeHtml(label)}</button>` : '';

export const homePage = (trending = [], region = 'US') => {
  const { shorts, videos } = splitVideos(trending);
  const first = trending[0] || videos[0] || shorts[0] || null;
  const body = `
    ${heroHeader({
      eyebrow: 'ホーム',
      title: '美しく、軽く、迷わない動画体験。',
      description: 'YouTube の導線を踏襲しつつ、視認性と回遊性を高めたモダンなフロントです。',
      meta: `<span class="pill">地域 ${escapeHtml(region)}</span><span class="pill">${formatCompactNumber(trending.length)} 件の候補</span>`,
    })}

    <section class="chip-row">
      ${['音楽', 'ゲーム', 'ライブ', 'ニュース', 'ポッドキャスト', '料理', '旅行'].map((label) => chip(label, searchUrl(label))).join('')}
    </section>

    ${heroPanel(first)}

    ${shorts.length ? section('ショート', renderGrid(shorts.slice(0, 12), 'short')) : ''}
    ${videos.length ? section('注目の動画', renderGrid(videos.slice(0, 18), 'grid')) : ''}
    ${!shorts.length && !videos.length ? '<div class="empty-state large">表示できるコンテンツがありません</div>' : ''}
  `;

  return { html: appShell({ title: 'AuroraTube', body, active: 'home' }), title: 'AuroraTube' };
};

export const resultsPage = (query, filters = {}, items = []) => {
  const { shorts, videos } = splitVideos(items);
  const channels = items.filter((item) => item?.type === 'channel');
  const playlists = items.filter((item) => item?.type === 'playlist');
  const body = `
    ${heroHeader({
      eyebrow: '検索',
      title: query || '検索結果',
      description: 'フィルタを使って、動画・ショート・チャンネルを切り替えられます。',
      meta: `<span class="pill">${formatNumber(items.length)} 件</span><span class="pill">${escapeHtml(filters.sort || 'relevance')}</span><span class="pill">${escapeHtml(filters.type || 'all')}</span>`,
    })}

    ${filterRow(query, filters)}

    ${shorts.length ? section('ショート', renderGrid(shorts, 'short')) : ''}
    ${videos.length ? section('動画', renderGrid(videos, 'grid')) : ''}
    ${channels.length ? section('チャンネル', renderChannels(channels)) : ''}
    ${playlists.length ? section('再生リスト', renderPlaylists(playlists)) : ''}
    ${!items.length ? '<div class="empty-state large">結果がありません</div>' : ''}
  `;

  return { html: appShell({ title: `${query || '検索'} - AuroraTube`, body, query, active: '' }), title: `${query || '検索'} - AuroraTube` };
};

const watchActions = (videoId, sourceUrl = '', pageUrl = '') => `
  <div class="watch-actions">
    <button class="watch-action" type="button" data-copy-link data-url="${escapeAttr(pageUrl)}">
      <span class="watch-action-icon">⧉</span>
      <span>コピー</span>
    </button>
    <button class="watch-action" type="button" data-share-link data-url="${escapeAttr(pageUrl)}">
      <span class="watch-action-icon">↗</span>
      <span>共有</span>
    </button>
    <a class="watch-action" href="${escapeAttr(sourceUrl || `/api/watch/${encodeURIComponent(videoId)}/download`)}">
      <span class="watch-action-icon">↓</span>
      <span>DL</span>
    </a>
  </div>
`;

const watchHeader = (video = {}, playback = {}, pageUrl = '') => `
  <section class="watch-head">
    <div class="watch-title-copy">
      <p class="eyebrow">${video.lengthSeconds && Number(video.lengthSeconds) <= 60 ? 'ショート' : '再生中'}</p>
      <h1 class="watch-title">${escapeHtml(video.title || '')}</h1>
      <div class="watch-meta-row">
        <span>${video.viewCount ? `${formatCompactNumber(video.viewCount)} 回視聴` : '0 回視聴'}</span>
        ${video.publishedText ? `<span>${escapeHtml(video.publishedText)}</span>` : ''}
        ${video.lengthSeconds ? `<span>${formatDuration(video.lengthSeconds)}</span>` : ''}
      </div>
    </div>
    ${watchActions(video.videoId || '', playback?.downloadUrl || '', pageUrl)}
  </section>
`;

const channelInfo = (video = {}) => video.authorId ? `
  <a class="channel-strip" href="${channelUrl(video.authorId)}">
    <span class="channel-strip-avatar">${avatar(video.authorThumbnails || [])}</span>
    <span class="channel-strip-copy">
      <strong class="channel-name">${escapeHtml(video.author || '')}</strong>
      <span class="channel-submeta">${escapeHtml(video.authorId || '')}${video.sourceLabel ? ` ・ ${escapeHtml(video.sourceLabel)}` : ''}</span>
    </span>
    <span class="channel-strip-arrow">${'›'}</span>
  </a>
` : '';

const descriptionBlock = (description = '') => description ? `<section class="description-card"><div class="description">${textBlock(description)}</div></section>` : '';

const commentsSection = (payload = {}, videoId = '') => {
  const comments = Array.isArray(payload.comments) ? payload.comments : [];
  return `
    <section class="section-block">
      <div class="section-head">
        <h2>コメント</h2>
        <span class="pill">${formatNumber(payload.video?.commentsCount || comments.length)} 件</span>
      </div>
      <div class="comments" data-comments>
        ${comments.map((comment) => commentCard(comment)).join('') || '<div class="empty-state">コメントがありません</div>'}
      </div>
      ${payload.commentsContinuation ? `<button class="ghost-btn load-more" type="button" data-load-comments="${escapeAttr(payload.commentsContinuation)}" data-video-id="${escapeAttr(videoId)}">さらに表示</button>` : ''}
    </section>
  `;
};

export const watchPage = (payload = {}) => {
  const video = payload.video || {};
  const related = Array.isArray(payload.related) ? payload.related.slice(0, 16) : [];
  const comments = Array.isArray(payload.comments) ? payload.comments : [];
  const playback = video.playback || {};
  const body = `
    <div class="watch-layout">
      <section class="watch-main">
        ${playerMarkup({ videoId: video.videoId || '', poster: thumbnailUrl(video.thumbnail || ''), short: false, playback })}
        ${watchHeader(video, playback, currentUrl().href)}
        ${channelInfo(video)}
        ${descriptionBlock(video.description || '')}
        ${commentsSection({ comments, commentsContinuation: payload.commentsContinuation, video }, video.videoId || '')}
      </section>

      <aside class="watch-rail">
        <section class="rail-card">
          <div class="section-head">
            <h2>関連動画</h2>
          </div>
          <div class="related-list">
            ${related.map((item) => videoCard(item, 'row')).join('') || '<div class="empty-state">関連動画がありません</div>'}
          </div>
        </section>
      </aside>
    </div>
  `;

  const title = `${video.title || 'Watch'} - AuroraTube`;
  return { html: appShell({ title, body, active: '' }), title };
};

export const shortsPage = (payload = {}) => {
  const video = payload.video || {};
  const related = Array.isArray(payload.related) ? payload.related.slice(0, 12) : [];
  const playback = video.playback || {};
  const body = `
    <div class="watch-layout shorts-layout">
      <section class="watch-main">
        ${playerMarkup({ videoId: video.videoId || '', poster: thumbnailUrl(video.thumbnail || ''), short: true, playback })}
        ${watchHeader(video, playback, currentUrl().href)}
        ${channelInfo(video)}
        ${descriptionBlock(video.description || '')}
      </section>

      <aside class="watch-rail">
        <section class="rail-card">
          <div class="section-head">
            <h2>次のショート</h2>
          </div>
          <div class="related-list short-related">
            ${related.map((item) => videoCard(item, 'short')).join('') || '<div class="empty-state">関連動画がありません</div>'}
          </div>
        </section>
      </aside>
    </div>
  `;

  const title = `${video.title || 'Shorts'} - AuroraTube`;
  return { html: appShell({ title, body, active: 'shorts' }), title };
};

const channelHeader = (header = {}, payload = {}) => `
  <section class="channel-hero">
    ${header.banner ? `<div class="channel-banner"><img src="${escapeAttr(thumbnailUrl(header.banner))}" alt="" loading="lazy" referrerpolicy="no-referrer" /></div>` : ''}
    <div class="channel-profile">
      <div class="channel-profile-avatar">${avatar(header.avatar ? [{ url: header.avatar }] : [])}</div>
      <div class="channel-profile-copy">
        <p class="eyebrow">チャンネル</p>
        <h1>${escapeHtml(header.name || payload.title || payload.channelId || '')}</h1>
        <div class="channel-submeta">${escapeHtml(header.id || payload.channelId || '')}${header.subCountText ? ` ・ ${escapeHtml(header.subCountText)}` : ''}${header.verified ? ' ・ Verified' : ''}</div>
        ${header.description ? `<p class="channel-description">${escapeHtml(header.description)}</p>` : ''}
      </div>
    </div>
    <div class="channel-tabs">
      <a href="#videos">動画</a>
      ${payload.playlists?.length ? '<a href="#playlists">再生リスト</a>' : ''}
      ${payload.relatedChannels?.length ? '<a href="#channels">チャンネル</a>' : ''}
      ${header.description ? '<a href="#about">概要</a>' : ''}
    </div>
  </section>
`;

export const channelPage = (payload = {}) => {
  const header = payload.header || {};
  const videos = Array.isArray(payload.videos) ? payload.videos : [];
  const playlists = Array.isArray(payload.playlists) ? payload.playlists : [];
  const relatedChannels = Array.isArray(payload.relatedChannels) ? payload.relatedChannels : [];
  const body = `
    <div class="channel-page">
      ${channelHeader(header, payload)}

      <section class="section-block" id="videos">
        <div class="section-head">
          <h2>動画</h2>
          ${renderLoadMore({ continuation: payload.continuation, id: payload.channelId || '', sortBy: payload.sortBy || 'newest', label: 'さらに表示', type: 'channel' })}
        </div>
        <div class="video-grid channel-video-grid" data-channel-grid>
          ${videos.map((item) => videoCard(item)).join('') || '<div class="empty-state">動画がありません</div>'}
        </div>
      </section>

      ${playlists.length ? `
        <section class="section-block" id="playlists">
          <div class="section-head"><h2>再生リスト</h2></div>
          <div class="playlist-grid">${playlists.map((item) => playlistCard(item)).join('')}</div>
        </section>
      ` : ''}

      ${relatedChannels.length ? `
        <section class="section-block" id="channels">
          <div class="section-head"><h2>関連チャンネル</h2></div>
          <div class="channel-grid">${relatedChannels.map((item) => channelCard(item)).join('')}</div>
        </section>
      ` : ''}

      ${header.description ? `<section class="section-block" id="about"><div class="description-card"><div class="description">${textBlock(header.description)}</div></div></section>` : ''}
    </div>
  `;

  const title = `${header.name || payload.title || payload.channelId || 'Channel'} - AuroraTube`;
  return { html: appShell({ title, body, active: '' }), title };
};

export const notFoundPage = () => ({
  html: appShell({
    title: '404 - AuroraTube',
    active: '',
    body: '<div class="empty-state large">ページが見つかりません。</div>',
  }),
  title: '404 - AuroraTube',
});
